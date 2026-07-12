const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const byId = (id) => document.getElementById(id);
const rate = (v) => Number(v || 0) / 100;
const CURRENT_STATE_KEY = "apartment-sim-v2";
const CUSTOMER_STORE_KEY = "apartment-sim-customers-v1";
const CURRENT_CUSTOMER_KEY = "apartment-sim-current-customer";

const defaultState = {
  customerName: "お客様",
  bankName: "サンプル銀行",
  propertyName: "サンプルアパート",
  location: "東京都",
  structure: "木造",
  landAreaSqm: 0,
  buildingAreaSqm: 0,
  buildingCoverage: 60,
  floorAreaRatio: 200,
  builtYear: 0,
  purchasePrice: 85000000,
  ownCapital: 12000000,
  loanAmount: 68000000,
  loanRate: 2.2,
  loanYears: 40,
  repaymentType: "元利均等",
  vacancyRate: 5,
  rentGrowthRate: 0,
  fixedAssetTax: 650000,
  propertyManagementRate: 5,
  salePriceGrowthRate: 1,
  sellingCostRate: 3,
  closingCosts: [
    ["仲介手数料", 2805000],
    ["登記費用", 500000],
    ["融資事務手数料", 680000],
    ["印紙代・その他", 150000],
  ],
  rentRoll: Array.from({ length: 20 }, (_, i) => {
    const floor = Math.floor(i / 5) + 1;
    const room = `${floor}${String((i % 5) + 1).padStart(2, "0")}`;
    return [room, "1K", i < 18 ? 65000 : 0, i < 18 ? "入居中" : "空室"];
  }),
};

let state = loadState();
let currentCustomerId = localStorage.getItem(CURRENT_CUSTOMER_KEY) || "";

function cloneDefault() {
  return JSON.parse(JSON.stringify(defaultState));
}

function blankState() {
  return {
    ...cloneDefault(),
    customerName: "",
    bankName: "",
    propertyName: "",
    location: "",
    structure: "",
    landAreaSqm: 0,
    buildingAreaSqm: 0,
    buildingCoverage: 0,
    floorAreaRatio: 0,
    builtYear: 0,
    purchasePrice: 0,
    ownCapital: 0,
    loanAmount: 0,
    loanRate: 0,
    loanYears: 0,
    repaymentType: "元利均等",
    vacancyRate: 0,
    rentGrowthRate: 0,
    fixedAssetTax: 0,
    propertyManagementRate: 0,
    salePriceGrowthRate: 0,
    sellingCostRate: 0,
    closingCosts: [
      ["", 0],
      ["", 0],
      ["", 0],
      ["", 0],
    ],
    rentRoll: [],
  };
}

function loadState() {
  const saved = localStorage.getItem(CURRENT_STATE_KEY);
  if (!saved) return cloneDefault();
  try {
    const parsed = JSON.parse(saved);
    return { ...cloneDefault(), ...parsed };
  } catch {
    return cloneDefault();
  }
}

function saveState() {
  localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(state));
}

function loadCustomerRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(CUSTOMER_STORE_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function saveCustomerRecords(records) {
  localStorage.setItem(CUSTOMER_STORE_KEY, JSON.stringify(records));
}

function customerTitle(data = state) {
  const customer = String(data.customerName || "").trim();
  const property = String(data.propertyName || "").trim();
  if (customer && property) return `${customer} / ${property}`;
  return customer || property || "";
}

function renderCustomerOptions() {
  return loadCustomerRecords()
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .map((record) => `<option value="${record.id}" ${record.id === currentCustomerId ? "selected" : ""}>${record.title}</option>`)
    .join("");
}

function saveCurrentCustomerRecord() {
  const title = customerTitle();
  if (!title) {
    alert("顧客名または物件名を入力してから保存してください。");
    return;
  }
  const records = loadCustomerRecords();
  const selected = byId("customerSelect")?.value || currentCustomerId;
  const existingIndex = records.findIndex((record) => record.id === selected);
  const now = new Date().toISOString();
  const record = {
    id: existingIndex >= 0 ? records[existingIndex].id : `customer-${Date.now()}`,
    title,
    updatedAt: now,
    data: JSON.parse(JSON.stringify(state)),
  };
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  currentCustomerId = record.id;
  localStorage.setItem(CURRENT_CUSTOMER_KEY, currentCustomerId);
  saveCustomerRecords(records);
  saveState();
  renderAll();
  alert("顧客データを保存しました。");
}

function loadCustomerRecord(id) {
  const record = loadCustomerRecords().find((item) => item.id === id);
  if (!record) {
    alert("顧客データが見つかりません。");
    return;
  }
  state = { ...cloneDefault(), ...record.data };
  currentCustomerId = record.id;
  localStorage.setItem(CURRENT_CUSTOMER_KEY, currentCustomerId);
  saveState();
  renderAll();
}

function deleteCustomerRecord(id) {
  if (!id) return;
  const records = loadCustomerRecords();
  const record = records.find((item) => item.id === id);
  if (!record) return;
  if (!confirm(`「${record.title}」を削除しますか？`)) return;
  saveCustomerRecords(records.filter((item) => item.id !== id));
  if (currentCustomerId === id) {
    currentCustomerId = "";
    localStorage.removeItem(CURRENT_CUSTOMER_KEY);
  }
  renderAll();
}

function occupiedRooms() {
  return state.rentRoll.filter((room) => room[3] === "入居中" && Number(room[2]) > 0);
}

function monthlyRent() {
  return occupiedRooms().reduce((sum, room) => sum + Number(room[2] || 0), 0);
}

function assumptions() {
  const rooms = state.rentRoll.length;
  const avgRent = rooms ? monthlyRent() / rooms : 0;
  const closing = state.closingCosts.reduce((sum, row) => sum + Number(row[1] || 0), 0);
  const totalInvestment = Number(state.purchasePrice || 0) + closing;
  return {
    rooms,
    avgRent,
    closing,
    totalInvestment,
    monthlyRent: monthlyRent(),
    annualGross: monthlyRent() * 12,
  };
}

function monthlyPmtAnnualDebtService(ratePercent = state.loanRate) {
  const principal = Number(state.loanAmount || 0);
  const years = Number(state.loanYears || 0);
  const monthlyRate = rate(ratePercent) / 12;
  const months = years * 12;
  if (!principal || !years) return 0;
  if (!monthlyRate) return principal / years;
  const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  return monthlyPayment * 12;
}

function annualDebtServiceForYear(beginBalance, ratePercent = state.loanRate) {
  const principal = Number(state.loanAmount || 0);
  const years = Number(state.loanYears || 0);
  if (!principal || !years) return 0;
  if (state.repaymentType === "元金均等") {
    return beginBalance * rate(ratePercent) + Math.min(principal / years, beginBalance);
  }
  return monthlyPmtAnnualDebtService(ratePercent);
}

function debtSchedule(maxYears = 40) {
  let balance = Number(state.loanAmount || 0);
  const years = Number(state.loanYears || 0);
  const rows = [];
  for (let year = 1; year <= maxYears; year += 1) {
    const begin = balance;
    const interest = begin * rate(state.loanRate);
    const debtService = year <= years ? annualDebtServiceForYear(begin) : 0;
    let principalPaid = year <= years ? debtService - interest : 0;
    if (state.repaymentType === "元金均等") {
      principalPaid = year <= years ? Math.min(Number(state.loanAmount || 0) / years, begin) : 0;
    }
    principalPaid = Math.min(Math.max(principalPaid, 0), begin);
    balance = Math.max(0, begin - principalPaid);
    rows.push({
      year,
      begin,
      debtService: year <= years ? interest + principalPaid : 0,
      interest,
      principal: principalPaid,
      end: balance,
      ltv: Number(state.purchasePrice) ? balance / Number(state.purchasePrice) : 0,
    });
  }
  return rows;
}

function annualCashflow(maxYears = 30) {
  const base = assumptions();
  const debt = debtSchedule(Math.max(40, maxYears));
  let cumulativePreTax = 0;
  return Array.from({ length: maxYears }, (_, index) => {
    const year = index + 1;
    const growth = Math.pow(1 + rate(state.rentGrowthRate), index);
    const gross = base.annualGross * growth;
    const vacancy = gross * rate(state.vacancyRate);
    const effective = gross - vacancy;
    const managementFee = effective * rate(state.propertyManagementRate);
    const repairs = Number(state.closingCosts.repairs || 0);
    const operatingExpense = Number(state.fixedAssetTax || 0) + managementFee;
    const noi = effective - operatingExpense;
    const d = debt[index] || { debtService: 0, end: 0 };
    const preTaxCf = noi - d.debtService;
    cumulativePreTax += preTaxCf;
    return { year, gross, vacancy, effective, managementFee, operatingExpense, noi, debtService: d.debtService, preTaxCf, cumulativePreTax, loanEnd: d.end, dscr: d.debtService ? noi / d.debtService : 0 };
  });
}

function approxIrr(initial, total, years) {
  if (!initial || !years || total <= 0) return 0;
  return Math.pow(total / initial, 1 / years) - 1;
}

function moneyCell(value) {
  const amount = Math.round(Number(value || 0));
  return `<td class="${amount < 0 ? "negative" : ""}">${yen.format(amount)}</td>`;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function table(headers, rows, cls = "") {
  return `<div class="table-wrap ${cls}"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function field(label, key, type = "number", step = "1") {
  const inputMode = type === "number" ? ' inputmode="decimal"' : "";
  return `<div class="field"><label>${label}</label><input data-key="${key}" type="${type}" step="${step}"${inputMode} value="${state[key] ?? ""}"></div>`;
}

function metric(label, value, warn = false) {
  return `<div class="metric ${warn ? "warn" : ""}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderSummary() {
  const a = assumptions();
  const cf1 = annualCashflow(1)[0];
  const surfaceYield = Number(state.purchasePrice || 0) ? a.annualGross / Number(state.purchasePrice) : 0;
  byId("summary").innerHTML = `
    <div class="panel hero-panel">
      <p class="kicker">${state.customerName || "お客様"} 提出用</p>
      <h2>${state.propertyName || "物件名未入力"}</h2>
      <div class="grid three">
        ${metric("金融機関", state.bankName || "-")}
        ${metric("所在地", state.location || "-")}
        ${metric("物件価格", yen.format(Number(state.purchasePrice || 0)))}
        ${metric("総投資額", yen.format(a.totalInvestment))}
        ${metric("年間満室賃料", yen.format(a.annualGross))}
        ${metric("表面利回り", pct(surfaceYield))}
        ${metric("初年度 税引前CF", yen.format(cf1.preTaxCf), cf1.preTaxCf < 0)}
        ${metric("DSCR", `${cf1.dscr.toFixed(2)}倍`, cf1.dscr < 1)}
        ${metric("返済期間", `${state.loanYears}年`)}
      </div>
    </div>
    <div class="panel">
      <h2>物件概要</h2>
      <div class="grid three">
        ${metric("構造", state.structure || "-")}
        ${metric("土地面積", `${number.format(state.landAreaSqm)}㎡`)}
        ${metric("建物面積", `${number.format(state.buildingAreaSqm)}㎡`)}
        ${metric("建蔽率", `${state.buildingCoverage}%`)}
        ${metric("容積率", `${state.floorAreaRatio}%`)}
        ${metric("築年数", `${state.builtYear}年`)}
      </div>
    </div>`;
}

function renderInputs() {
  byId("inputs").innerHTML = `
    <div class="panel">
      <h2>顧客データ保存・読込</h2>
      <div class="customer-tools">
        <div class="field">
          <label>保存済み顧客</label>
          <select id="customerSelect">
            <option value="">選択してください</option>
            ${renderCustomerOptions()}
          </select>
        </div>
        <div class="actions-row">
          <button id="saveCustomerBtn" class="primary" type="button">現在の内容を保存</button>
          <button id="loadCustomerBtn" type="button">開く</button>
          <button id="deleteCustomerBtn" type="button">削除</button>
          <button id="newCustomerBtn" type="button">新規入力</button>
        </div>
      </div>
      <p class="note">顧客名または物件名を入力してから保存してください。保存データはこの端末のブラウザ内に保存されます。</p>
    </div>
    <div class="panel">
      <h2>基本情報</h2>
      <div class="grid two">
        ${field("顧客名", "customerName", "text")}
        ${field("物件名", "propertyName", "text")}
        ${field("所在地", "location", "text")}
        ${field("構造", "structure", "text")}
        ${field("土地面積（㎡）", "landAreaSqm", "number", "0.01")}
        ${field("建物面積（㎡）", "buildingAreaSqm", "number", "0.01")}
        ${field("建蔽率（％）", "buildingCoverage")}
        ${field("容積率（％）", "floorAreaRatio")}
        ${field("築年数（年）", "builtYear")}
      </div>
    </div>
    <div class="panel">
      <h2>借入・税金・出口条件</h2>
      <div class="grid two">
        ${field("金融機関", "bankName", "text")}
        ${field("物件価格", "purchasePrice")}
        ${field("自己資金", "ownCapital")}
        ${field("借入金額", "loanAmount")}
        ${field("借入金利（％）", "loanRate", "number", "0.01")}
        ${field("返済期間（年・最長40年）", "loanYears", "number", "1")}
        <div class="field"><label>返済方式</label><select data-key="repaymentType"><option ${state.repaymentType === "元利均等" ? "selected" : ""}>元利均等</option><option ${state.repaymentType === "元金均等" ? "selected" : ""}>元金均等</option></select></div>
        ${field("空室率（％）", "vacancyRate", "number", "0.1")}
        ${field("家賃上昇率（％）", "rentGrowthRate", "number", "0.1")}
        ${field("固定資産税等（円）", "fixedAssetTax")}
        ${field("管理委託料率（％）", "propertyManagementRate", "number", "0.1")}
        ${field("売却価格成長率（％）", "salePriceGrowthRate")}
        ${field("売却費用率（％）", "sellingCostRate")}
      </div>
    </div>
    <div class="panel">
      <h2>入力時の注意事項</h2>
      <p class="note">率は「5」のように整数で入力してください。固定資産税等は毎年同額として計算します。返済期間は40年まで対応し、元利均等は月利・月数でPMT計算した毎月返済額を12倍しています。入力内容はこの端末に自動保存されます。</p>
    </div>`;
}

function renderRentroll() {
  const a = assumptions();
  const rows = state.rentRoll.map((room, index) => `
    <tr>
      <td><input data-rent="${index},0" type="text" value="${room[0]}"></td>
      <td><input data-rent="${index},1" type="text" value="${room[1]}"></td>
      <td><input data-rent="${index},2" type="number" inputmode="numeric" value="${room[2]}"></td>
      <td><select data-rent="${index},3"><option ${room[3] === "入居中" ? "selected" : ""}>入居中</option><option ${room[3] === "空室" ? "selected" : ""}>空室</option></select></td>
    </tr>`);
  byId("rentroll").innerHTML = `
    <div class="panel">
      <h2>レントロール</h2>
      <div class="grid three">
        ${metric("部屋数", `${a.rooms}部屋`)}
        ${metric("入居中", `${occupiedRooms().length}部屋`)}
        ${metric("平均月額家賃", yen.format(a.avgRent))}
      </div>
    </div>
    <div class="panel">${table(["部屋番号", "間取り", "月額家賃", "入居状況"], rows, "compact")}</div>`;
}

function renderCosts() {
  const rows = state.closingCosts.map((row, index) => `<tr><td><input data-cost="${index},0" type="text" value="${row[0]}"></td><td><input data-cost="${index},1" type="number" inputmode="numeric" value="${row[1]}"></td></tr>`);
  byId("costs").innerHTML = `
    <div class="panel">
      <h2>諸費用入力</h2>
      ${table(["項目", "金額"], rows, "compact")}
      <div class="grid two totals">
        ${metric("諸費用合計", yen.format(assumptions().closing))}
        ${metric("総投資額", yen.format(assumptions().totalInvestment))}
      </div>
    </div>`;
}

function renderAnnual() {
  const rows = annualCashflow(30).map((row) => `<tr><td>${row.year}年目</td>${moneyCell(row.gross)}${moneyCell(row.vacancy)}${moneyCell(row.effective)}${moneyCell(row.operatingExpense)}${moneyCell(row.noi)}${moneyCell(row.debtService)}${moneyCell(row.preTaxCf)}<td>${row.dscr.toFixed(2)}</td>${moneyCell(row.loanEnd)}${moneyCell(row.cumulativePreTax)}</tr>`);
  byId("annual").innerHTML = `<div class="panel"><h2>年次収支（30年）</h2>${table(["年", "満室想定賃料", "空室損", "実効総収入", "運営費", "NOI", "借入返済額", "税引前CF", "DSCR", "期末ローン残高", "累計税引前CF"], rows)}</div>`;
}

function renderDebt() {
  const rows = debtSchedule(40).map((row) => `<tr><td>${row.year}年目</td>${moneyCell(row.begin)}${moneyCell(row.debtService)}${moneyCell(row.interest)}${moneyCell(row.principal)}${moneyCell(row.end)}<td>${pct(row.ltv)}</td></tr>`);
  byId("debt").innerHTML = `<div class="panel"><h2>借入返済（40年）</h2>${table(["年", "期首残高", "年間返済額", "利息", "元金返済", "期末残高", "借入比率"], rows)}</div>`;
}

function renderSensitivity() {
  const rates = [1.5, 2, 2.5, 3, 3.5, 4];
  const vacancies = [0, 3, 5, 8, 10, 15];
  const originalRate = state.loanRate;
  const originalVacancy = state.vacancyRate;
  const rowsCf = vacancies.map((vacancy) => `<tr><th>${vacancy.toFixed(1)}%</th>${rates.map((loanRate) => {
    state.loanRate = loanRate;
    state.vacancyRate = vacancy;
    return moneyCell(annualCashflow(1)[0].preTaxCf);
  }).join("")}</tr>`);
  const rowsDscr = vacancies.map((vacancy) => `<tr><th>${vacancy.toFixed(1)}%</th>${rates.map((loanRate) => {
    state.loanRate = loanRate;
    state.vacancyRate = vacancy;
    return `<td>${annualCashflow(1)[0].dscr.toFixed(2)}倍</td>`;
  }).join("")}</tr>`);
  state.loanRate = originalRate;
  state.vacancyRate = originalVacancy;
  byId("sensitivity").innerHTML = `<div class="panel"><h2>感度分析</h2><h3>初年度 税引前CF：空室率 / 金利</h3>${table(["空室率 / 金利", ...rates.map((r) => `${r.toFixed(1)}%`)], rowsCf)}<h3>初年度 DSCR：空室率 / 金利</h3>${table(["空室率 / 金利", ...rates.map((r) => `${r.toFixed(1)}%`)], rowsDscr)}</div>`;
}

function renderSale() {
  const annual = annualCashflow(30);
  const years = [5, 10, 15, 20, 25, 30];
  const yields = [5.5, 6, 6.5, 7];
  const rows = [];
  years.forEach((holdingYear) => {
    yields.forEach((capRate, index) => {
      const row = annual[holdingYear - 1];
      const salePrice = row.gross / rate(capRate);
      const sellingCost = salePrice * rate(state.sellingCostRate);
      const netProceeds = salePrice - sellingCost - row.loanEnd;
      const totalReturn = row.cumulativePreTax + netProceeds;
      const irr = approxIrr(assumptions().totalInvestment, totalReturn, holdingYear);
      rows.push(`<tr><td>${index === 0 ? `${holdingYear}年目` : ""}</td><td>${capRate.toFixed(1)}%</td>${moneyCell(row.gross)}${moneyCell(row.cumulativePreTax)}${moneyCell(salePrice)}${moneyCell(sellingCost)}${moneyCell(row.loanEnd)}${moneyCell(netProceeds)}${moneyCell(totalReturn)}<td>${pct(irr)}</td></tr>`);
    });
  });
  byId("sale").innerHTML = `<div class="panel"><h2>売却シミュレーション</h2>${table(["保有年数", "売却条件", "年間家賃収入", "差引収益（累計）", "売却額", "売却諸費用", "ローン残債", "売却時手取額", "総回収額", "IRR"], rows)}</div>`;
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

document.addEventListener("input", (event) => {
  const key = event.target.dataset.key;
  if (key) {
    state[key] = event.target.type === "number" ? Number(event.target.value) : event.target.value;
    if (key === "loanYears") state[key] = Math.min(Math.max(Number(event.target.value || 0), 0), 40);
  }
  const rent = event.target.dataset.rent;
  if (rent) {
    const [index, fieldIndex] = rent.split(",").map(Number);
    state.rentRoll[index][fieldIndex] = fieldIndex === 2 ? Number(event.target.value) : event.target.value;
  }
  const cost = event.target.dataset.cost;
  if (cost) {
    const [index, fieldIndex] = cost.split(",").map(Number);
    state.closingCosts[index][fieldIndex] = fieldIndex === 1 ? Number(event.target.value) : event.target.value;
  }
  saveState();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "customerSelect") return;
  if (event.target.dataset.key) state[event.target.dataset.key] = event.target.value;
  const rent = event.target.dataset.rent;
  if (rent) {
    const [index, fieldIndex] = rent.split(",").map(Number);
    state.rentRoll[index][fieldIndex] = event.target.value;
  }
  saveState();
  renderAll();
});

document.addEventListener("focusout", (event) => {
  if (event.target.id === "customerSelect") return;
  if (event.target.matches("input, select")) {
    renderAll();
  }
});

document.addEventListener("click", (event) => {
  if (event.target.id === "saveCustomerBtn") {
    saveCurrentCustomerRecord();
  }

  if (event.target.id === "loadCustomerBtn") {
    const id = byId("customerSelect")?.value;
    if (!id) {
      alert("開く顧客データを選択してください。");
      return;
    }
    loadCustomerRecord(id);
  }

  if (event.target.id === "deleteCustomerBtn") {
    const id = byId("customerSelect")?.value;
    if (!id) {
      alert("削除する顧客データを選択してください。");
      return;
    }
    deleteCustomerRecord(id);
  }

  if (event.target.id === "newCustomerBtn") {
    if (!confirm("現在の入力内容をクリアして新規入力を始めますか？")) return;
    currentCustomerId = "";
    localStorage.removeItem(CURRENT_CUSTOMER_KEY);
    state = blankState();
    saveState();
    renderAll();
  }
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab,.view").forEach((element) => element.classList.remove("active"));
    button.classList.add("active");
    byId(button.dataset.view).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

byId("saveBtn").addEventListener("click", () => {
  saveState();
  alert("入力内容を保存しました。顧客ごとに残す場合は、入力画面の「現在の内容を保存」を押してください。");
});

byId("printBtn").addEventListener("click", () => window.print());

byId("resetBtn").addEventListener("click", () => {
  if (confirm("入力内容をすべてクリアしますか？")) {
    localStorage.removeItem(CURRENT_STATE_KEY);
    localStorage.removeItem(CURRENT_CUSTOMER_KEY);
    currentCustomerId = "";
    state = blankState();
    saveState();
    renderAll();
  }
});

renderAll();
