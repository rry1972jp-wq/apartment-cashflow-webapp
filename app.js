const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
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
  access: "最寄駅 徒歩圏",
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
  rateIncreaseStartYear: 0,
  rateIncreaseMargin: 0,
  repaymentType: "元利均等",
  vacancyRate: 5,
  rentGrowthRate: 0,
  fixedAssetTax: 650000,
  acquisitionTaxEstimate: 0,
  annualPropertyTaxEstimate: 650000,
  operatingCost: 0,
  propertyManagementRate: 5,
  salePriceGrowthRate: 1,
  sellingCostRate: 3,
  closingCosts: [
    ["仲介手数料", 2805000],
    ["登記費用", 500000],
    ["融資事務手数料", 680000],
    ["印紙代・その他", 150000],
    ["", 0],
    ["", 0],
    ["", 0],
    ["", 0],
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

function emptyRentRollRows(count = 20) {
  return Array.from({ length: count }, () => ["", "", 0, "空室"]);
}

function emptyClosingCostRows(count = 8) {
  return Array.from({ length: count }, () => ["", 0]);
}

function normalizeClosingCosts(rows) {
  const normalized = Array.isArray(rows)
    ? rows.map((row) => [row?.[0] ?? "", Number(row?.[1] || 0)])
    : [];
  while (normalized.length < 8) normalized.push(["", 0]);
  return normalized.slice(0, 8);
}

function normalizeRentRoll(rows) {
  const normalized = Array.isArray(rows)
    ? rows.map((row) => {
        const status = row?.[3] === "入居中" || row?.[3] === "蜈･螻・ｸｭ" ? "入居中" : "空室";
        return [row?.[0] ?? "", row?.[1] ?? "", Number(row?.[2] || 0), status];
      })
    : [];
  while (normalized.length < 20) normalized.push(["", "", 0, "空室"]);
  return normalized.slice(0, 20);
}

function normalizeState(data) {
  return {
    ...data,
    closingCosts: normalizeClosingCosts(data.closingCosts),
    rentRoll: normalizeRentRoll(data.rentRoll),
  };
}

function blankState() {
  return normalizeState({
    ...cloneDefault(),
    customerName: "",
    bankName: "",
    propertyName: "",
    location: "",
    access: "",
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
    rateIncreaseStartYear: 0,
    rateIncreaseMargin: 0,
    repaymentType: "元利均等",
    vacancyRate: 0,
    rentGrowthRate: 0,
    fixedAssetTax: 0,
    acquisitionTaxEstimate: 0,
    annualPropertyTaxEstimate: 0,
    operatingCost: 0,
    propertyManagementRate: 0,
    salePriceGrowthRate: 0,
    sellingCostRate: 0,
    closingCosts: emptyClosingCostRows(),
    rentRoll: emptyRentRollRows(),
  });
}

function loadState() {
  const saved = localStorage.getItem(CURRENT_STATE_KEY);
  if (!saved) return cloneDefault();
  try {
    const parsed = JSON.parse(saved);
    return normalizeState({ ...cloneDefault(), ...parsed });
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
  state = normalizeState({ ...cloneDefault(), ...record.data });
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

function enteredRentRollRows() {
  return state.rentRoll.filter((room) => {
    const roomNumber = String(room[0] || "").trim();
    const layout = String(room[1] || "").trim();
    const rent = Number(room[2] || 0);
    const status = room[3] === "入居中";
    return Boolean(roomNumber || layout || rent > 0 || status);
  });
}

function monthlyRent() {
  return occupiedRooms().reduce((sum, room) => sum + Number(room[2] || 0), 0);
}

function assumptions() {
  const rooms = enteredRentRollRows().length;
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

function loanTermYears() {
  return Math.min(Math.max(Math.floor(Number(state.loanYears || 0)), 0), 40);
}

function rateIncreaseStartYear() {
  return Math.min(Math.max(Math.floor(Number(state.rateIncreaseStartYear || 0)), 0), loanTermYears());
}

function loanRateForYear(year) {
  const startYear = rateIncreaseStartYear();
  const margin = Number(state.rateIncreaseMargin || 0);
  return startYear && margin && year >= startYear ? Number(state.loanRate || 0) + margin : Number(state.loanRate || 0);
}

function annualPaymentByMonthlyPmt(principal, ratePercent, years) {
  const monthlyRate = rate(ratePercent) / 12;
  const months = years * 12;
  if (!principal || !years) return 0;
  if (!monthlyRate) return principal / years;
  const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  return monthlyPayment * 12;
}

function debtSchedule(maxYears = 40) {
  let balance = Number(state.loanAmount || 0);
  const years = loanTermYears();
  const totalMonths = years * 12;
  const monthlyPrincipal = totalMonths ? balance / totalMonths : 0;
  const rows = [];
  let monthlyPayment = annualPaymentByMonthlyPmt(balance, state.loanRate, years) / 12;

  for (let year = 1; year <= maxYears; year += 1) {
    const begin = balance;
    const currentRate = loanRateForYear(year);
    let debtService = 0;
    let interest = 0;
    let principalPaid = 0;

    for (let month = 1; month <= 12; month += 1) {
      const elapsedMonths = (year - 1) * 12 + month;
      if (elapsedMonths > totalMonths || balance <= 0) break;

      if (state.repaymentType === "元利均等" && month === 1 && year === rateIncreaseStartYear()) {
        const remainingMonths = totalMonths - elapsedMonths + 1;
        monthlyPayment = annualPaymentByMonthlyPmt(balance, currentRate, remainingMonths / 12) / 12;
      }

      const monthlyInterest = balance * (rate(currentRate) / 12);
      let monthlyPrincipalPaid;
      let monthlyDebtService;

      if (state.repaymentType === "元金均等") {
        monthlyPrincipalPaid = Math.min(monthlyPrincipal, balance);
        monthlyDebtService = monthlyPrincipalPaid + monthlyInterest;
      } else {
        monthlyDebtService = Math.min(monthlyPayment, balance + monthlyInterest);
        monthlyPrincipalPaid = Math.max(monthlyDebtService - monthlyInterest, 0);
      }

      monthlyPrincipalPaid = Math.min(monthlyPrincipalPaid, balance);
      balance = Math.max(0, balance - monthlyPrincipalPaid);
      debtService += monthlyDebtService;
      interest += monthlyInterest;
      principalPaid += monthlyPrincipalPaid;
    }

    rows.push({
      year,
      begin,
      debtService,
      rate: currentRate,
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
    const operatingExpense = Number(state.fixedAssetTax || 0) + Number(state.operatingCost || 0) + managementFee;
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

function equityInvestment() {
  const ownCapital = Number(state.ownCapital || 0);
  const inferredEquity = Math.max(Number(state.purchasePrice || 0) - Number(state.loanAmount || 0), 0);
  if (ownCapital > 0) return ownCapital;
  return inferredEquity + assumptions().closing;
}

function ccrBaseCapital() {
  return equityInvestment();
}

function calculateIrr(cashflows) {
  const npv = (rateValue) => cashflows.reduce((sum, value, index) => sum + value / Math.pow(1 + rateValue, index), 0);
  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);

  if (!cashflows.some((value) => value < 0) || !cashflows.some((value) => value > 0)) return null;
  while (lowValue * highValue > 0 && high < 1000) {
    high *= 2;
    highValue = npv(high);
  }
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (Math.abs(midValue) < 0.01) return mid;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return (low + high) / 2;
}

function moneyCell(value) {
  const amount = Math.round(Number(value || 0));
  return `<td class="${amount < 0 ? "negative" : ""}">${yen.format(amount)}</td>`;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function pct2(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function pctOrDash(value) {
  return value === null || !Number.isFinite(value) ? "-" : pct(value);
}

function table(headers, rows, cls = "") {
  return `<div class="table-wrap ${cls}"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function field(label, key, type = "number", step = "1") {
  const inputMode = type === "number" ? ' inputmode="decimal"' : "";
  return `<div class="field"><label>${label}</label><input data-key="${key}" type="${type}" step="${step}"${inputMode} value="${state[key] ?? ""}"></div>`;
}

function parseNumberInput(value) {
  return Number(String(value ?? "").replace(/,/g, "")) || 0;
}

function readFormattedInput(target) {
  if (target.dataset.format === "money") return parseNumberInput(target.value);
  if (target.dataset.format === "man-yen") return parseNumberInput(target.value) * 10000;
  return target.type === "number" ? Number(target.value) : target.value;
}

function formatAmountInput(value) {
  return integer.format(Number(value || 0));
}

function formatManInput(value) {
  return integer.format(Math.round(Number(value || 0) / 10000));
}

function moneyField(label, key) {
  return `<div class="field"><label>${label}</label><input data-key="${key}" data-format="money" type="text" inputmode="numeric" value="${formatAmountInput(state[key])}"></div>`;
}

function metric(label, value, warn = false) {
  return `<div class="metric ${warn ? "warn" : ""}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function proposalBox(label, value, unit = "") {
  return `<div class="proposal-box"><div class="proposal-box-label">${label}</div><div class="proposal-box-value">${value}<span>${unit}</span></div></div>`;
}

function manYen(value) {
  return number.format(Math.round(Number(value || 0) / 10000));
}

function proposalRow(label, value) {
  return `<div class="proposal-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function proposalTaxInput(label, key) {
  return `
    <label class="proposal-tax-row">
      <span>${label}</span>
      <strong><input data-key="${key}" data-format="man-yen" type="text" inputmode="numeric" value="${formatManInput(state[key])}"><em>万円（概算）</em></strong>
    </label>`;
}

function renderSummary() {
  const a = assumptions();
  const cf1 = annualCashflow(1)[0];
  const surfaceYield = Number(state.purchasePrice || 0) ? a.annualGross / Number(state.purchasePrice) : 0;
  const ccrBase = ccrBaseCapital();
  const ccr = ccrBase ? cf1.preTaxCf / ccrBase : 0;
  byId("summary").innerHTML = `
    <div class="panel hero-panel">
      <p class="kicker">${state.customerName || "お客様"} 提出用</p>
      <h2>${state.propertyName || "物件名未入力"}</h2>
      <div class="grid three">
        ${metric("金融機関", state.bankName || "-")}
        ${metric("所在地", state.location || "-")}
        ${metric("交通", state.access || "-")}
        ${metric("物件価格", yen.format(Number(state.purchasePrice || 0)))}
        ${metric("諸費用合計", yen.format(a.closing))}
        ${metric("総投資額", yen.format(a.totalInvestment))}
        ${metric("年間満室賃料", yen.format(a.annualGross))}
        ${metric("表面利回り", pct2(surfaceYield))}
        ${metric("CCR", pct(ccr))}
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

function renderProposal() {
  const a = assumptions();
  const cf1 = annualCashflow(1)[0];
  const debt1 = debtSchedule(1)[0] || { debtService: 0 };
  const surfaceYield = Number(state.purchasePrice || 0) ? a.annualGross / Number(state.purchasePrice) : 0;
  const ccrBase = ccrBaseCapital();
  const ccr = ccrBase ? cf1.preTaxCf / ccrBase : 0;
  const monthlyCf = cf1.preTaxCf / 12;
  const roomCount = `${a.rooms}戸`;
  const today = new Date().toLocaleDateString("ja-JP");
  const totalExpense = cf1.operatingExpense + debt1.debtService;

  byId("proposal").innerHTML = `
    <div class="proposal-sheet">
      <header class="proposal-header">
        <div>
          <p class="proposal-eyebrow">Investment Proposal</p>
          <h2>${state.propertyName || "物件名未入力"}</h2>
          <p class="proposal-subtitle">${state.location || "所在地未入力"}　${state.access || ""}</p>
        </div>
        <div class="proposal-meta">
          <span>${today}</span>
          <strong>${state.customerName || "お客様"} 御中</strong>
          <em>${state.bankName || "金融機関未入力"}</em>
        </div>
      </header>

      <section class="proposal-hero">
        <div class="proposal-hero-main">
          <span>年間税引前CF</span>
          <strong>${yen.format(cf1.preTaxCf)}</strong>
          <small>月間CF ${yen.format(monthlyCf)}</small>
        </div>
        <div class="proposal-kpi">
          ${proposalBox("表面利回り", pct2(surfaceYield))}
          ${proposalBox("CCR", pct(ccr))}
          ${proposalBox("DSCR", `${cf1.dscr.toFixed(2)}倍`)}
        </div>
      </section>

      <div class="proposal-main">
        <section class="proposal-panel">
          <h3>資金計画</h3>
          <div class="proposal-money-grid">
            ${proposalBox("物件価格", manYen(state.purchasePrice), "万円")}
            ${proposalBox("諸費用", manYen(a.closing), "万円")}
            ${proposalBox("総投資額", manYen(a.totalInvestment), "万円")}
            ${proposalBox("自己資金", manYen(state.ownCapital), "万円(諸費用込み)")}
            ${proposalBox("借入金額", manYen(state.loanAmount), "万円")}
            ${proposalBox("返済期間", `${loanTermYears()}年`)}
          </div>

          <h3>物件概要</h3>
          <div class="proposal-detail-grid">
            ${proposalRow("所在地", state.location || "-")}
            ${proposalRow("交通", state.access || "-")}
            ${proposalRow("構造", state.structure || "-")}
            ${proposalRow("築年数", `${Number(state.builtYear || 0)}年`)}
            ${proposalRow("部屋数", roomCount)}
            ${proposalRow("土地面積", `${number.format(Number(state.landAreaSqm || 0))}㎡`)}
            ${proposalRow("建物面積", `${number.format(Number(state.buildingAreaSqm || 0))}㎡`)}
            ${proposalRow("建蔽率 / 容積率", `${Number(state.buildingCoverage || 0)}% / ${Number(state.floorAreaRatio || 0)}%`)}
          </div>
        </section>

        <section class="proposal-panel">
          <h3>収支計画</h3>
          <div class="proposal-flow">
            <div>
              <span>収入合計</span>
              <strong>${yen.format(a.annualGross)}</strong>
            </div>
            <div>
              <span>支出合計</span>
              <strong>${yen.format(totalExpense)}</strong>
            </div>
            <div class="is-emphasis">
              <span>年間CF</span>
              <strong>${yen.format(cf1.preTaxCf)}</strong>
            </div>
          </div>

          <div class="proposal-split">
            <div>
              <h4>収入内訳</h4>
              ${proposalRow("満室想定賃料", yen.format(a.annualGross))}
              ${proposalRow("空室損", yen.format(cf1.vacancy))}
              ${proposalRow("実効総収入", yen.format(cf1.effective))}
            </div>
            <div>
              <h4>支出内訳</h4>
              ${proposalRow("年間返済額", yen.format(debt1.debtService))}
              ${proposalRow("運営経費", yen.format(Number(state.operatingCost || 0)))}
              ${proposalRow("管理委託料", yen.format(cf1.managementFee))}
              <div class="proposal-tax-panel">
                <h4>&#128311;税金・その他</h4>
                <div class="proposal-tax-blank" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="proposal-footer">
        <p>本シミュレーションは満室時想定に基づく試算です。市場動向、空室、賃料変動、金利変動、修繕費等により実際の収支は変動します。</p>
        <strong>Agratio urban design Inc.</strong>
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
        ${field("交通", "access", "text")}
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
        ${moneyField("物件価格", "purchasePrice")}
        ${moneyField("自己資金（諸費用込み）", "ownCapital")}
        ${moneyField("借入金額", "loanAmount")}
        ${field("借入金利（％）", "loanRate", "number", "0.01")}
        ${field("金利上昇開始年（0で上昇なし）", "rateIncreaseStartYear", "number", "1")}
        ${field("金利上昇幅（％）", "rateIncreaseMargin", "number", "0.01")}
        <div class="field"><label>上昇後金利</label><input type="text" value="${(Number(state.loanRate || 0) + Number(state.rateIncreaseMargin || 0)).toFixed(2)}%" readonly></div>
        ${field("返済期間（年・最長40年）", "loanYears", "number", "1")}
        <div class="field"><label>返済方式</label><select data-key="repaymentType"><option ${state.repaymentType === "元利均等" ? "selected" : ""}>元利均等</option><option ${state.repaymentType === "元金均等" ? "selected" : ""}>元金均等</option></select></div>
        ${field("空室率（％）", "vacancyRate", "number", "0.1")}
        ${field("家賃上昇率（％）", "rentGrowthRate", "number", "0.1")}
        ${moneyField("固定資産税等（円）", "fixedAssetTax")}
        ${moneyField("運営経費（年額・円）", "operatingCost")}
        ${field("管理委託料率（％）", "propertyManagementRate", "number", "0.1")}
        ${field("売却価格成長率（％）", "salePriceGrowthRate")}
        ${field("売却費用率（％）", "sellingCostRate")}
      </div>
    </div>
    <div class="panel">
      <h2>入力時の注意事項</h2>
      <p class="note">率は「5」のように整数で入力してください。金利上昇開始年を0にすると金利上昇なしで計算します。固定資産税等は毎年同額として計算します。返済期間は40年まで対応し、元利均等は月利・月数でPMT計算した毎月返済額を12倍しています。入力内容はこの端末に自動保存されます。</p>
    </div>`;
}

function renderRentroll() {
  if (!state.rentRoll.length) state.rentRoll = emptyRentRollRows();
  const a = assumptions();
  const rows = state.rentRoll.map((room, index) => `
    <tr>
      <td><input data-rent="${index},0" type="text" value="${room[0]}"></td>
      <td><input data-rent="${index},1" type="text" value="${room[1]}"></td>
      <td><input data-rent="${index},2" data-format="money" type="text" inputmode="numeric" value="${formatAmountInput(room[2])}"></td>
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
  state.closingCosts = normalizeClosingCosts(state.closingCosts);
  const rows = state.closingCosts.map((row, index) => `<tr><td><input data-cost="${index},0" type="text" value="${row[0]}"></td><td><input data-cost="${index},1" data-format="money" type="text" inputmode="numeric" value="${formatAmountInput(row[1])}"></td></tr>`);
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
  const displayYears = loanTermYears();
  const rows = debtSchedule(displayYears).map((row) => `<tr><td>${row.year}年目</td><td>${Number(row.rate || 0).toFixed(2)}%</td>${moneyCell(row.begin)}${moneyCell(row.debtService)}${moneyCell(row.interest)}${moneyCell(row.principal)}${moneyCell(row.end)}<td>${pct(row.ltv)}</td></tr>`);
  byId("debt").innerHTML = `<div class="panel"><h2>借入返済（${displayYears}年）</h2>${table(["年", "適用金利", "期首残高", "年間返済額", "利息", "元金返済", "期末残高", "借入比率"], rows)}</div>`;
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
      const yearlyCashflows = annual.slice(0, holdingYear).map((item) => item.preTaxCf);
      yearlyCashflows[yearlyCashflows.length - 1] += netProceeds;
      const irr = calculateIrr([-equityInvestment(), ...yearlyCashflows]);
      rows.push(`<tr><td>${index === 0 ? `${holdingYear}年目` : ""}</td><td>${capRate.toFixed(1)}%</td>${moneyCell(row.gross)}${moneyCell(row.cumulativePreTax)}${moneyCell(salePrice)}${moneyCell(sellingCost)}${moneyCell(row.loanEnd)}${moneyCell(netProceeds)}${moneyCell(totalReturn)}<td>${pctOrDash(irr)}</td></tr>`);
    });
  });
  byId("sale").innerHTML = `<div class="panel"><h2>売却シミュレーション</h2>${table(["保有年数", "売却条件", "年間家賃収入", "差引収益（累計）", "売却額", "売却諸費用", "ローン残債", "売却時手取額", "総回収額", "IRR"], rows)}</div>`;
}

function renderAll() {
  renderSummary();
  renderProposal();
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
      state[key] = readFormattedInput(event.target);
      if (key === "loanYears") state[key] = Math.min(Math.max(Number(event.target.value || 0), 0), 40);
      if (key === "rateIncreaseStartYear") state[key] = Math.min(Math.max(Number(event.target.value || 0), 0), loanTermYears());
    }
  const rent = event.target.dataset.rent;
  if (rent) {
    const [index, fieldIndex] = rent.split(",").map(Number);
    state.rentRoll[index][fieldIndex] = fieldIndex === 2 ? parseNumberInput(event.target.value) : event.target.value;
  }
  const cost = event.target.dataset.cost;
  if (cost) {
    const [index, fieldIndex] = cost.split(",").map(Number);
    state.closingCosts[index][fieldIndex] = fieldIndex === 1 ? parseNumberInput(event.target.value) : event.target.value;
  }
  saveState();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "customerSelect") return;
  if (event.target.dataset.key) state[event.target.dataset.key] = readFormattedInput(event.target);
  const rent = event.target.dataset.rent;
  if (rent) {
    const [index, fieldIndex] = rent.split(",").map(Number);
    state.rentRoll[index][fieldIndex] = fieldIndex === 2 ? parseNumberInput(event.target.value) : event.target.value;
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
