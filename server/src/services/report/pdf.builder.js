const PDFDocument = require("pdfkit");

// Print-friendly palette echoing the web app's "signal" theme (teal =
// analysis/AI, amber = live/in-progress, green/red = clear outcomes).
const COLORS = {
  ink: "#14171F",
  inkSoft: "#525B66",
  inkFaint: "#8A93A0",
  line: "#E2E8E6",
  paperTint: "#F3F5F6",
  teal: "#0F766E",
  tealSoft: "#E4F2F0",
  amber: "#B7791F",
  amberSoft: "#FBF0DD",
  green: "#15803D",
  greenSoft: "#E6F4EA",
  red: "#B91C1C",
  redSoft: "#FBEAEA",
};

const PAGE_MARGIN = 50;

const newDocument = () =>
  new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: "Interview Report" },
  });

const formatDate = (dateLike) => {
  if (!dateLike) return "—";
  try {
    return new Date(dateLike).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (_err) {
    return "—";
  }
};

/**
 * Masthead: eyebrow label, big title, candidate/job/date meta line, rule.
 */
const drawHeader = (doc, { eyebrow, title, candidateName, jobDescription, dateStr }) => {
  doc.fillColor(COLORS.teal).fontSize(10).font("Helvetica-Bold").text(eyebrow.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.ink).fontSize(22).font("Helvetica-Bold").text(title);
  doc.moveDown(0.4);
  doc.fillColor(COLORS.inkSoft).fontSize(11).font("Helvetica").text(
    `${candidateName || "Candidate"}  ·  ${jobDescription ? truncate(jobDescription, 70) : "Role not specified"}  ·  ${dateStr}`
  );
  doc.moveDown(0.8);
  drawRule(doc);
  doc.moveDown(1);
};

const truncate = (str, max) => (str && str.length > max ? `${str.slice(0, max - 1)}…` : str || "");

const drawRule = (doc) => {
  const y = doc.y;
  doc.save().strokeColor(COLORS.line).lineWidth(1).moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).stroke().restore();
};

// Full-width flowing text calls (no explicit x) drift onto whatever
// doc.x was left at by the previous absolute-positioned call — e.g.
// after drawBulletList's last `text(item, PAGE_MARGIN + 14, ...)`, plain
// `doc.text(nextTitle)` would start at PAGE_MARGIN + 14, not the true
// margin. Every block helper resets doc.x itself so it never depends on
// what ran before it.
const resetCursorX = (doc) => {
  doc.x = PAGE_MARGIN;
};

const contentWidth = (doc) => doc.page.width - PAGE_MARGIN * 2;

const drawSectionTitle = (doc, text) => {
  ensureSpace(doc, 30);
  resetCursorX(doc);
  doc.fillColor(COLORS.ink).fontSize(13).font("Helvetica-Bold").text(text, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.4);
};

const drawParagraph = (doc, text, { width } = {}) => {
  ensureSpace(doc, 20);
  resetCursorX(doc);
  doc
    .fillColor(COLORS.inkSoft)
    .fontSize(10.5)
    .font("Helvetica")
    .text(text || "—", PAGE_MARGIN, doc.y, { width: width || contentWidth(doc), lineGap: 3 });
  doc.moveDown(0.8);
};

const drawBulletList = (doc, items, { emptyText = "None noted." } = {}) => {
  resetCursorX(doc);
  if (!items || items.length === 0) {
    doc.fillColor(COLORS.inkFaint).fontSize(10.5).font("Helvetica-Oblique").text(emptyText, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
    doc.moveDown(0.8);
    return;
  }
  items.forEach((item) => {
    ensureSpace(doc, 18);
    const startY = doc.y;
    doc.fillColor(COLORS.teal).fontSize(10.5).font("Helvetica-Bold").text("—", PAGE_MARGIN, startY, { continued: false, width: 12 });
    doc.fillColor(COLORS.inkSoft).fontSize(10.5).font("Helvetica").text(item, PAGE_MARGIN + 14, startY, {
      width: doc.page.width - PAGE_MARGIN * 2 - 14,
      lineGap: 2,
    });
    doc.moveDown(0.35);
  });
  doc.moveDown(0.5);
};

/**
 * A rounded status pill, e.g. recommendation or result label.
 */
const drawPill = (doc, text, { x, y, tone = "teal" } = {}) => {
  const toneMap = {
    teal: [COLORS.tealSoft, COLORS.teal],
    amber: [COLORS.amberSoft, COLORS.amber],
    green: [COLORS.greenSoft, COLORS.green],
    red: [COLORS.redSoft, COLORS.red],
  };
  const [bg, fg] = toneMap[tone] || toneMap.teal;
  doc.font("Helvetica-Bold").fontSize(10);
  const textWidth = doc.widthOfString(text);
  const paddingX = 10;
  const width = textWidth + paddingX * 2;
  const height = 20;
  const startX = x ?? doc.x;
  const startY = y ?? doc.y;
  doc.save();
  doc.roundedRect(startX, startY, width, height, height / 2).fill(bg);
  doc.fillColor(fg).text(text, startX + paddingX, startY + 5, { width: textWidth + 2, lineBreak: false });
  doc.restore();
  return { width, height };
};

/**
 * Large circular score display with a numeric value in the center.
 */
const drawScoreCircle = (doc, score, { x, y, radius = 40, tone = "teal" } = {}) => {
  const toneMap = { teal: COLORS.teal, amber: COLORS.amber, green: COLORS.green, red: COLORS.red };
  const color = toneMap[tone] || COLORS.teal;
  const cx = x + radius;
  const cy = y + radius;
  doc.save();
  doc.lineWidth(6).strokeColor(COLORS.line).circle(cx, cy, radius).stroke();
  if (typeof score === "number") {
    const pct = Math.max(0, Math.min(100, score)) / 100;
    doc
      .lineWidth(6)
      .strokeColor(color)
      .arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2)
      .stroke();
  }
  doc.restore();
  const label = typeof score === "number" ? String(Math.round(score)) : "—";
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(20).text(label, x, cy - 12, { width: radius * 2, align: "center" });
  doc.fillColor(COLORS.inkFaint).font("Helvetica").fontSize(8).text("/ 100", x, cy + 10, { width: radius * 2, align: "center" });
};

/**
 * Horizontal competency bars — skill name, bar, numeric score.
 */
const drawCompetencyBars = (doc, competencyScores) => {
  resetCursorX(doc);
  if (!competencyScores || competencyScores.length === 0) {
    doc
      .fillColor(COLORS.inkFaint)
      .fontSize(10.5)
      .font("Helvetica-Oblique")
      .text("No competency breakdown available.", PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
    doc.moveDown(0.8);
    return;
  }

  const barWidth = doc.page.width - PAGE_MARGIN * 2 - 140;
  competencyScores.forEach((c) => {
    ensureSpace(doc, 38);
    const rowY = doc.y;
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(c.skill, PAGE_MARGIN, rowY, { width: 120 });
    const barX = PAGE_MARGIN + 130;
    const barY = rowY + 2;
    doc.save().roundedRect(barX, barY, barWidth, 8, 4).fill(COLORS.paperTint);
    const filled = Math.max(0, Math.min(100, Number(c.score) || 0)) / 100;
    if (filled > 0) {
      doc.roundedRect(barX, barY, Math.max(8, barWidth * filled), 8, 4).fill(COLORS.teal);
    }
    doc.restore();
    doc.fillColor(COLORS.inkSoft).font("Helvetica-Bold").fontSize(9).text(`${Math.round(c.score)}`, barX + barWidth + 8, rowY, { width: 24 });
    doc.moveDown(0.15);
    if (c.justification) {
      doc.fillColor(COLORS.inkFaint).font("Helvetica").fontSize(8.5).text(c.justification, PAGE_MARGIN + 130, doc.y, {
        width: barWidth,
        lineGap: 1,
      });
    }
    doc.moveDown(0.6);
  });
  doc.moveDown(0.3);
};

const ensureSpace = (doc, height) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
};

/**
 * Adds a footer (generated-by line + page number) to every buffered
 * page. Must be called right before doc.end(), after all content has
 * been written, since it walks the already-buffered page range.
 *
 * IMPORTANT: the footer sits inside the page's bottom margin on
 * purpose. PDFKit's `.text()` treats `page.margins.bottom` as a hard
 * content boundary and will silently call addPage() (creating a spurious
 * blank trailing page) if asked to draw below it — even with explicit
 * x/y coordinates. Zeroing the margin just for this call keeps the
 * footer inside the physical page without ever triggering that.
 */
const finalizeWithFooters = (doc, footerLeftText) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const bottom = doc.page.height - PAGE_MARGIN + 14;
    doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(PAGE_MARGIN, bottom - 8).lineTo(doc.page.width - PAGE_MARGIN, bottom - 8).stroke();
    doc.fillColor(COLORS.inkFaint).font("Helvetica").fontSize(8);
    doc.text(footerLeftText, PAGE_MARGIN, bottom, { width: 320, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 150, bottom, {
      width: 150,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = originalBottomMargin;
  }
};

module.exports = {
  COLORS,
  newDocument,
  formatDate,
  drawHeader,
  drawRule,
  drawSectionTitle,
  drawParagraph,
  drawBulletList,
  drawPill,
  drawScoreCircle,
  drawCompetencyBars,
  ensureSpace,
  finalizeWithFooters,
};
