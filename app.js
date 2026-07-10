const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const byId = (id) => document.getElementById(id);
const rate = (v) => Number(v || 0) / 100;

const defaultState = {
  customerName: "〇〇 様",
  bankName: "",
  propertyName: "収益アパート",
  location: "",
  structure: "木造",
  landAreaSqm: 0,
  buildingAreaSqm: 0,
  buildingCoverage: 60,
  floorAreaRatio: 200,
  builtYear: 0,
  purchasePrice: 80000000,
  ownCapital: 12000000,
  loanAmount: 68000000,
  loanRate: 2.2,
  loanYears: 35,
  repaymentType: "元利均等",
  vacancyRate: 5,
  rentGrowthRate: 0,
  expenseRate: 18,
  fixedAssetTax: 500000,
  propertyManagementRate: 5,
  sellingCostRate: 3,
  salePriceGrowthRate: 0,
  closingCosts: [
    ["仲介手数料", 2706000],
    ["登記費用", 500000],
    ["融資事務手数料", 680000],
    ["印紙・その他", 150000],
  ],
  rentRoll: Array.from({ length: 20 }, (_, i) => [`${101 + i}`, "1K", i < 18 ? 65000 : 0, i < 18 ? "入居中" : "空室"]),
};

let state = loadState();

function loadState() {
  const saved = localStorage.getItem("apartment-sim");
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem("apartment-sim", JSON.stringify(state));
}

function occupiedRooms() {
  return state.rentRoll.filter((r) => r[3] === "入居中" && Number(r[2]) > 0);
}

function monthlyRent() {
  return occupiedRooms().reduce((sum, r) => sum + Number(r[2] || 0), 0);
}

function assumptions() {
  const rooms = state.rentRoll.length;
  const avgRent = rooms ? monthlyRent() / rooms : 0;
  const closing = state.closingCosts.reduce((sum, r) => sum + Number(r[1] || 0), 0);
  const totalInvestment = Number(state.purchasePrice) + closing;
  return {
    rooms,
    avgRent,
    closing,
    totalInvestment,
    monthlyRent: monthlyRent(),
    annualGross: monthlyRent() * 12,
  };
}

function annualDebtService() {
  const principal = Number(state.loanAmount || 0);
  const years = Number(state.loanYears || 35);
  const r = rate(state.loanRate) / 12;
  if (!principal || !years) return 0;
  if (state.repaymentType === "元金均等") {
    return principal / years + principal * rate(state.loanRate);
  }
  if (!r) return principal / years;
  return (principal * r * Math.pow(1 + r, years * 12)) / (Math.pow(1 + r, years * 12) - 1) * 12;
}

function debtSchedule(maxYears = 35) {
  let balance = Number(state.loanAmount || 0);
  const principal = Number(state.loanAmount || 0);
  const years = Number(state.loanYears || 35);
  const annualRate = rate(state.loanRate);
  const fixedPrincipal = years ? principal / years : 0;
  const pmt = annualDebtService();
  const rows = [];
  for (let year = 1; year <= maxYears; year += 1) {
    const begin = balance;
    const interest = begin * annualRate;
    let principalPaid = state.repaymentType === "元金均等" ? fixedPrincipal : pmt - interest;
    if (year > years) principalPaid = 0;
    principalPaid = Math.min(Math.max(principalPaid, 0), balance);
    const debtService = year > years ? 0 : interest + principalPaid;
    balance = Math.max(0, balance - principalPaid);
    rows.push({ year, begin, interest, principal: principalPaid, debtService, end: balance, ltv: Number(state.purchasePrice) ? balance / Number(state.purchasePrice) : 0 });
  }
  return rows;
}

function annualCashflow(maxYears = 30) {
  const a = assumptions();
  const debt = debtSchedule(Math.max(35, maxYears));
  let cumPre = 0;
  return Array.from({ length: maxYears }, (_, idx) => {
    const year = idx + 1;
    const growth = Math.pow(1 + rate(state.rentGrowthRate), idx);
    const gross = a.annualGross * growth;
    const vacancy = gross * rate(state.vacancyRate);
    const effective = gross - vacancy;
    const operatingExpense = effective * rate(state.expenseRate) + effective * rate(state.propertyManagementRate) + Number(state.fixedAssetTax || 0);
    const noi = effective - operatingExpense;
    const d = debt[idx];
    const preTaxCf = noi - d.debtService;
    cumPre += preTaxCf;
    return { year, gross, vacancy, effective, operatingExpense, noi, debtService: d.debtService, preTaxCf, cumPre, loanEnd: d.end, dscr: d.debtService ? noi / d.debtService : 0 };
  });
}

function approxIrr(initial, total, years) {
  if (!initial || !years || total <= 0) return 0;
  return Math.pow(total / initial, 1 / years) - 1;
}

function moneyCell(v) {
  return `<td class="${v < 0 ? "negative" : ""}">${yen.format(Math.round(v || 0))}</td>`;
}

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

function table(headers, rows, cls = "") {
  return `<div class="table-wrap ${cls}"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function field(label, key, type = "number", step = "1") {
  return `<div class="field"><label>${label}</label><input data-key="${key}" type="${type}" step="${step}" value="${state[key] ?? ""}"></div>`;
}

function metric(label, value, warn = false) {
  return `<div class="metric ${warn ? "warn" : ""}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderSummary() {
  const a = assumptions();
  const cf1 = annualCashflow(1)[0];
  byId("summary").innerHTML = `
    <div class="panel">
      <h2>${state.customerName || "お客様"} 提出用</h2>
      <div class="grid three">
        ${metric("物件名", state.propertyName || "-")}
        ${metric("金融機関", state.bankName || "-")}
        ${metric("所在地", state.location || "-")}
        ${metric("戸数", `${a.rooms}戸`)}
        ${metric("平均月額家賃", yen.format(a.avgRent))}
        ${metric("年間満室賃料", yen.format(a.annualGross))}
        ${metric("表面利回り", `${num.format(a.annualGross / Number(state.purchasePrice || 1) * 100)}%`)}
        ${metric("初年度税引前CF", yen.format(cf1.preTaxCf), cf1.preTaxCf < 0)}
        ${metric("DSCR", `${cf1.dscr.toFixed(2)}倍`, cf1.dscr < 1)}
      </div>
    </div>
    <div class="panel">
      <h2>物件概要</h2>
      <div class="grid three">
        ${metric("構造", state.structure || "-")}
        ${metric("土地面積", `${num.format(state.landAreaSqm)}㎡`)}
        ${metric("建物面積", `${num.format(state.buildingAreaSqm)}㎡`)}
        ${metric("建ぺい率", `${state.buildingCoverage}%`)}
        ${metric("容積率", `${state.floorAreaRatio}%`)}
        ${metric("築年数", `${state.builtYear}年`)}
      </div>
    </div>`;
}

function renderInputs() {
  byId("inputs").innerHTML = `
    <div class="panel">
      <h2>基本条件</h2>
      <div class="grid two">
        ${field("お客様名", "customerName", "text")}
        ${field("物件名", "propertyName", "text")}
        ${field("所在地", "location", "text")}
        ${field("構造", "structure", "text")}
        ${field("土地面積（㎡）", "landAreaSqm", "number", "0.01")}
        ${field("建物面積（㎡）", "buildingAreaSqm", "number", "0.01")}
        ${field("建ぺい率（％）", "buildingCoverage")}
        ${field("容積率（％）", "floorAreaRatio")}
        ${field("築年数（年）", "builtYear")}
      </div>
    </div>
    <div class="panel">
      <h2>借入・税金・出口条件</h2>
      <div class="grid two">
        ${field("金融機関", "bankName", "text")}
        ${field("物件価格（税込）", "purchasePrice")}
        ${field("自己資金", "ownCapital")}
        ${field("借入金額", "loanAmount")}
        ${field("借入金利（％）", "loanRate", "number", "0.01")}
        ${field("借入期間（年）", "loanYears")}
        <div class="field"><label>返済方法</label><select data-key="repaymentType"><option ${state.repaymentType === "元利均等" ? "selected" : ""}>元利均等</option><option ${state.repaymentType === "元金均等" ? "selected" : ""}>元金均等</option></select></div>
        ${field("空室率（％）", "vacancyRate", "number", "0.1")}
        ${field("賃料成長率（％）", "rentGrowthRate", "number", "0.1")}
        ${field("運営費率（％）", "expenseRate", "number", "0.1")}
        ${field("固定資産税等（円）", "fixedAssetTax")}
        ${field("管理費率（％）", "propertyManagementRate", "number", "0.1")}
        ${field("売却価格成長率", "salePriceGrowthRate")}
        ${field("売却費用率", "sellingCostRate")}
      </div>
    </div>
    <div class="panel">
      <h2>入力時の注意事項</h2>
      <p class="note">黄色の入力欄を変更すると、表紙・年次収支・借入返済・感度分析・売却シミュレーションへ自動反映されます。金額は円単位、利率は「3」のように整数または小数で入力してください。レントロールの家賃は月額で入力します。</p>
    </div>`;
}

function renderRentroll() {
  const a = assumptions();
  const rows = state.rentRoll.map((r, i) => `
    <tr>
      <td><input data-rent="${i},0" type="text" value="${r[0]}"></td>
      <td><input data-rent="${i},1" type="text" value="${r[1]}"></td>
      <td><input data-rent="${i},2" type="number" value="${r[2]}"></td>
      <td><select data-rent="${i},3"><option ${r[3] === "入居中" ? "selected" : ""}>入居中</option><option ${r[3] === "空室" ? "selected" : ""}>空室</option></select></td>
    </tr>`);
  byId("rentroll").innerHTML = `
    <div class="panel">
      <h2>レントロール</h2>
      <div class="grid three">
        ${metric("部屋数", `${a.rooms}部屋`)}
        ${metric("反映戸数", `${a.rooms}戸`)}
        ${metric("平均月額家賃", yen.format(a.avgRent))}
      </div>
    </div>
    <div class="panel">${table(["部屋番号", "間取り", "月額家賃", "入居状況"], rows, "compact")}</div>`;
}

function renderCosts() {
  const rows = state.closingCosts.map((r, i) => `<tr><td><input data-cost="${i},0" type="text" value="${r[0]}"></td><td><input data-cost="${i},1" type="number" value="${r[1]}"></td></tr>`);
  byId("costs").innerHTML = `
    <div class="panel">
      <h2>諸費用入力</h2>
      ${table(["項目", "金額"], rows, "compact")}
      <h3>合計</h3>
      <div class="grid two">${metric("諸費用合計", yen.format(assumptions().closing))}${metric("総投資額", yen.format(assumptions().totalInvestment))}</div>
    </div>`;
}

function renderAnnual() {
  const rows = annualCashflow(30).map((r) => `<tr><td>${r.year}年目</td>${moneyCell(r.gross)}${moneyCell(r.vacancy)}${moneyCell(r.effective)}${moneyCell(r.operatingExpense)}${moneyCell(r.noi)}${moneyCell(r.debtService)}${moneyCell(r.preTaxCf)}<td>${r.dscr.toFixed(2)}</td></tr>`);
  byId("annual").innerHTML = `<div class="panel"><h2>年次収支（30年）</h2>${table(["年", "満室賃料", "空室損", "実効収入", "運営費", "NOI", "借入返済", "税引前CF", "DSCR"], rows)}</div>`;
}

function renderDebt() {
  const rows = debtSchedule(35).map((r) => `<tr><td>${r.year}年目</td>${moneyCell(r.begin)}${moneyCell(r.debtService)}${moneyCell(r.interest)}${moneyCell(r.principal)}${moneyCell(r.end)}<td>${pct(r.ltv)}</td></tr>`);
  byId("debt").innerHTML = `<div class="panel"><h2>借入返済（35年）</h2>${table(["年", "期首残高", "年間返済額", "利息", "元金返済", "期末残高", "LTV"], rows)}</div>`;
}

function renderSensitivity() {
  const rates = [1.5, 2, 2.5, 3, 3.5, 4];
  const vacancies = [0, 3, 5, 8, 10, 15];
  const baseLoan = state.loanRate;
  const baseVac = state.vacancyRate;
  const rowsCf = vacancies.map((v) => `<tr><th>${v.toFixed(1)}%</th>${rates.map((r) => { state.loanRate = r; state.vacancyRate = v; return moneyCell(annualCashflow(1)[0].preTaxCf); }).join("")}</tr>`);
  const rowsDscr = vacancies.map((v) => `<tr><th>${v.toFixed(1)}%</th>${rates.map((r) => { state.loanRate = r; state.vacancyRate = v; return `<td>${annualCashflow(1)[0].dscr.toFixed(2)}倍</td>`; }).join("")}</tr>`);
  state.loanRate = baseLoan;
  state.vacancyRate = baseVac;
  byId("sensitivity").innerHTML = `<div class="panel"><h2>感度分析</h2><h3>初年度 税引前CF：空室率 / 金利</h3>${table(["空室率 / 金利", ...rates.map((r) => `${r.toFixed(1)}%`)], rowsCf)}<h3>初年度 DSCR：空室率 / 金利</h3>${table(["空室率 / 金利", ...rates.map((r) => `${r.toFixed(1)}%`)], rowsDscr)}</div>`;
}

function renderSale() {
  const annual = annualCashflow(30);
  const years = [5, 10, 15, 20, 25, 30];
  const yields = [5.5, 6, 6.5, 7];
  const rows = [];
  years.forEach((y) => {
    yields.forEach((cap, idx) => {
      const r = annual[y - 1];
      const growth = Math.pow(1 + rate(state.salePriceGrowthRate), y - 1);
      const sale = (r.gross * growth) / rate(cap);
      const cost = sale * rate(state.sellingCostRate);
      const net = sale - cost - r.loanEnd;
      const total = r.cumPre + net;
      const irr = approxIrr(assumptions().totalInvestment, total, y);
      rows.push(`<tr><td>${idx === 0 ? `${y}年目` : ""}</td><td>${cap.toFixed(1)}%</td>${moneyCell(r.gross)}${moneyCell(r.cumPre)}${moneyCell(sale)}${moneyCell(cost)}${moneyCell(r.loanEnd)}${moneyCell(net)}${moneyCell(total)}<td>${pct(irr)}</td></tr>`);
    });
  });
  byId("sale").innerHTML = `<div class="panel"><h2>売却シミュレーション</h2>${table(["保有年数", "売却条件", "年間家賃収入", "差引収益累計", "売却額", "売却諸費用", "ローン残債", "売却時手残り", "総回収額", "IRR概算"], rows)}</div>`;
}

function renderAll() {
  renderSummary();
  renderInputs();
  renderRentroll();
  renderCosts();
  renderAnnual();
  renderDebt();
  renderSensitivity();
  renderSale();
}

document.addEventListener("input", (e) => {
  const key = e.target.dataset.key;
  if (key) state[key] = e.target.type === "number" ? Number(e.target.value) : e.target.value;
  const rent = e.target.dataset.rent;
  if (rent) {
    const [i, j] = rent.split(",").map(Number);
    state.rentRoll[i][j] = j === 2 ? Number(e.target.value) : e.target.value;
  }
  const cost = e.target.dataset.cost;
  if (cost) {
    const [i, j] = cost.split(",").map(Number);
    state.closingCosts[i][j] = j === 1 ? Number(e.target.value) : e.target.value;
  }
  saveState();
  renderAll();
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.key) state[e.target.dataset.key] = e.target.value;
  if (e.target.dataset.rent) {
    const [i, j] = e.target.dataset.rent.split(",").map(Number);
    state.rentRoll[i][j] = e.target.value;
  }
  saveState();
  renderAll();
});

document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab,.view").forEach((el) => el.classList.remove("active"));
  btn.classList.add("active");
  byId(btn.dataset.view).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}));

byId("saveBtn").addEventListener("click", () => {
  saveState();
  alert("保存しました");
});

byId("printBtn").addEventListener("click", () => window.print());

byId("resetBtn").addEventListener("click", () => {
  if (confirm("初期値に戻しますか？")) {
    localStorage.removeItem("apartment-sim");
    state = structuredClone(defaultState);
    renderAll();
  }
});

renderAll();
