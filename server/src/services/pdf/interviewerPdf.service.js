const PDFDocument = require("pdfkit");

const formatTime = (totalSeconds) => {
  if (totalSeconds == null || isNaN(totalSeconds)) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Generate a professional, multi-page Interviewer Performance Report PDF.
 *
 * @param {Object} opts
 * @param {Object} opts.interview - Interview row from DB
 * @param {Object} opts.interviewer - Interviewer user row
 * @param {Object} opts.report - Interviewer report row with report_json
 * @param {Object|null} opts.analytics - Analytics row with analytics_json
 * @returns {Promise<Buffer>} PDF Buffer
 */
const generateInterviewerReportPdf = ({ interview, interviewer, report, analytics, segments }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 45,
        size: "A4",
        bufferPages: true,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on("error", (err) => reject(err));

      const rpt = report.report_json || {};
      const aj = analytics?.analytics_json || {};

      const contentWidth = doc.page.width - 90;

      // Color Palette — Sky & Slate
      const PRIMARY = "#0284C7";     // Ocean/Sky Blue
      const SECONDARY = "#0F172A";   // Slate 900
      const TEXT_MAIN = "#0F172A";   // Text
      const TEXT_MUTED = "#64748B";  // Muted
      const BG_CARD = "#F8FAFC";     // Light Slate
      const BORDER_CLR = "#E2E8F0";  // Border
      const GREEN = "#10B981";       // Strength
      const AMBER = "#F59E0B";       // Warning
      const RED = "#EF4444";         // Improvement

      const checkSpace = (neededHeight) => {
        if (doc.y + neededHeight > doc.page.height - 55) {
          doc.addPage();
        }
      };

      const renderSectionHeading = (title, iconText = "■") => {
        checkSpace(35);
        doc.moveDown(0.6);
        doc.x = 45;
        doc.fontSize(12).font("Helvetica-Bold").fillColor(PRIMARY).text(`${iconText}  ${title.toUpperCase()}`, 45, doc.y);
        doc.x = 45;
        doc.strokeColor(BORDER_CLR).lineWidth(0.75)
           .moveTo(45, doc.y + 3)
           .lineTo(45 + contentWidth, doc.y + 3)
           .stroke();
        doc.moveDown(0.5);
        doc.x = 45;
      };

      // ── HEADER ──────────────────────────────────────────────────────────
      doc.rect(45, 40, contentWidth, 75).fill(SECONDARY);

      doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
         .text("AI INTERVIEW PLATFORM", 60, 52, { characterSpacing: 1.5 });

      doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold")
         .text("INTERVIEWER PERFORMANCE REPORT", 60, 68);

      doc.fillColor("#94A3B8").fontSize(8.5).font("Helvetica")
         .text(`Interview ID: ${interview.id}`, 60, 92)
         .text(`Generated: ${new Date().toLocaleDateString()}`, 45 + contentWidth - 140, 92, { align: "right", width: 125 });

      doc.y = 125;

      // ── INTERVIEWER & SESSION META ────────────────────────────────────────
      doc.rect(45, doc.y, contentWidth, 48).fillAndStroke(BG_CARD, BORDER_CLR);
      const metaY = doc.y + 10;

      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
         .text("INTERVIEWER NAME", 60, metaY)
         .text("CANDIDATE INTERVIEWED", 220, metaY)
         .text("DURATION", 380, metaY);

      doc.fillColor(TEXT_MAIN).fontSize(10).font("Helvetica-Bold")
         .text(interviewer?.name || "Interviewer", 60, metaY + 12)
         .text(interview.candidate_name || "Candidate", 220, metaY + 12)
         .text(aj.duration?.formatted || (interview.duration_seconds ? formatTime(interview.duration_seconds) : "Completed"), 380, metaY + 12);

      doc.y = metaY + 46;

      // ── EXECUTIVE SUMMARY & OVERALL SCORE ──────────────────────────────────
      renderSectionHeading("Executive Evaluation");

      const scoreBoxWidth = 110;
      const summaryBoxWidth = contentWidth - scoreBoxWidth - 12;
      const startBoxY = doc.y;

      // Score Box
      doc.rect(45, startBoxY, scoreBoxWidth, 90).fillAndStroke(PRIMARY, PRIMARY);
      doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text("OVERALL SCORE", 45, startBoxY + 16, { align: "center", width: scoreBoxWidth });
      doc.fillColor("#FFFFFF").fontSize(26).font("Helvetica-Bold").text(`${rpt.overallScore ?? 0}`, 45, startBoxY + 32, { align: "center", width: scoreBoxWidth });
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica").text("/ 100", 45, startBoxY + 62, { align: "center", width: scoreBoxWidth });

      // Summary Text Box
      doc.rect(45 + scoreBoxWidth + 12, startBoxY, summaryBoxWidth, 90).fillAndStroke(BG_CARD, BORDER_CLR);
      doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica")
         .text(rpt.summary || "Comprehensive analysis of interviewer conduct, question structuring, follow-up depth, and conversational balance.", 45 + scoreBoxWidth + 24, startBoxY + 16, {
           width: summaryBoxWidth - 24,
           lineGap: 3,
         });

      doc.y = startBoxY + 100;

      // ── SCORECARD BREAKDOWN ────────────────────────────────────────────────
      renderSectionHeading("Interviewer Scorecard");

      const dimensions = [
        { label: "Question Quality", score: rpt.questionQuality?.score ?? 0 },
        { label: "Follow-up Quality", score: rpt.followUpQuality?.score ?? 0 },
        { label: "Interview Structure", score: rpt.interviewStructure?.score ?? 0 },
        { label: "Candidate Engagement", score: rpt.candidateEngagement?.score ?? 0 },
        { label: "Communication & Clarity", score: rpt.communication?.score ?? 0 },
      ];

      const barStartX = 200;
      const maxBarWidth = contentWidth - 190;

      dimensions.forEach((dim) => {
        checkSpace(24);
        const currY = doc.y;

        doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica-Bold")
           .text(dim.label, 50, currY + 3, { width: 140 });

        doc.rect(barStartX, currY + 4, maxBarWidth, 10).fill("#E2E8F0");

        const fillWidth = Math.max(2, (dim.score / 100) * maxBarWidth);
        const barColor = dim.score >= 75 ? GREEN : dim.score >= 50 ? AMBER : RED;
        doc.rect(barStartX, currY + 4, fillWidth, 10).fill(barColor);

        doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica-Bold")
           .text(`${dim.score}/100`, barStartX + maxBarWidth + 10, currY + 3);

        doc.y = currY + 20;
      });

      // ── STRENGTHS & AREAS FOR IMPROVEMENT ──────────────────────────────────
      renderSectionHeading("Interviewer Strengths & Coaching Areas");

      const colWidth = (contentWidth - 12) / 2;
      const startColY = doc.y;

      const strengthsList = [
        ...(rpt.questionQuality?.strengths || []),
        ...(rpt.followUpQuality?.strengths || []),
      ].slice(0, 4);
      if (strengthsList.length === 0) strengthsList.push("Maintained professional tone and clear role discussion.");

      const improvementList = (rpt.areasForImprovement || []).slice(0, 4);
      if (improvementList.length === 0) improvementList.push("Allow candidate adequate thinking time before probing further.");

      let strY = startColY + 26;
      strengthsList.forEach((s) => {
        const textH = doc.heightOfString(s, { width: colWidth - 25 });
        strY += Math.max(18, textH + 4);
      });

      let impY = startColY + 26;
      improvementList.forEach((imp) => {
        const textH = doc.heightOfString(imp, { width: colWidth - 25 });
        impY += Math.max(18, textH + 4);
      });

      const colHeight = Math.max(110, Math.max(strY, impY) - startColY + 12);

      // Render containers
      doc.rect(45, startColY, colWidth, colHeight).fillAndStroke(BG_CARD, BORDER_CLR);
      doc.fillColor(GREEN).fontSize(9).font("Helvetica-Bold").text("INTERVIEWER STRENGTHS", 55, startColY + 10);

      strY = startColY + 26;
      strengthsList.forEach((s) => {
        doc.fillColor(GREEN).fontSize(8).font("Helvetica-Bold").text("✓", 55, strY);
        doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica").text(s, 67, strY, { width: colWidth - 25, lineGap: 2 });
        strY += Math.max(18, doc.heightOfString(s, { width: colWidth - 25 }) + 4);
      });

      doc.rect(45 + colWidth + 12, startColY, colWidth, colHeight).fillAndStroke(BG_CARD, BORDER_CLR);
      doc.fillColor(AMBER).fontSize(9).font("Helvetica-Bold").text("COACHING & IMPROVEMENTS", 55 + colWidth + 12, startColY + 10);

      impY = startColY + 26;
      improvementList.forEach((imp) => {
        doc.fillColor(AMBER).fontSize(8).font("Helvetica-Bold").text("•", 55 + colWidth + 12, impY);
        doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica").text(imp, 67 + colWidth + 12, impY, { width: colWidth - 25, lineGap: 2 });
        impY += Math.max(18, doc.heightOfString(imp, { width: colWidth - 25 }) + 4);
      });

      doc.y = startColY + colHeight + 12;

      // ── QUESTION QUALITY & FOLLOW-UP ANALYSIS ─────────────────────────────
      if (rpt.strongQuestions?.length > 0 || rpt.weakQuestions?.length > 0) {
        renderSectionHeading("Question Quality & Follow-Up Analysis");

        if (rpt.strongQuestions && rpt.strongQuestions.length > 0) {
          rpt.strongQuestions.slice(0, 3).forEach((q) => {
            checkSpace(55);
            const qY = doc.y;
            doc.rect(45, qY, contentWidth, 48).fillAndStroke(BG_CARD, BORDER_CLR);

            const timeTag = q.startTime != null ? ` (${formatTime(q.startTime)})` : "";
            doc.fillColor(GREEN).fontSize(8.5).font("Helvetica-Bold")
               .text(`Strong Question${timeTag}: "${q.question}"`, 55, qY + 8, { width: contentWidth - 20 });

            doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Oblique")
               .text(`Reason: ${q.reason || "Effective technical probe."}`, 55, qY + 26, { width: contentWidth - 20 });

            doc.y = qY + 54;
          });
        }

        if (rpt.weakQuestions && rpt.weakQuestions.length > 0) {
          rpt.weakQuestions.slice(0, 2).forEach((q) => {
            checkSpace(55);
            const qY = doc.y;
            doc.rect(45, qY, contentWidth, 48).fillAndStroke(BG_CARD, BORDER_CLR);

            const timeTag = q.startTime != null ? ` (${formatTime(q.startTime)})` : "";
            doc.fillColor(AMBER).fontSize(8.5).font("Helvetica-Bold")
               .text(`Question to Improve${timeTag}: "${q.question}"`, 55, qY + 8, { width: contentWidth - 20 });

            doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Oblique")
               .text(`Suggestion: ${q.reason || "Could be more open-ended."}`, 55, qY + 26, { width: contentWidth - 20 });

            doc.y = qY + 54;
          });
        }
      }

      // ── CONVERSATIONAL DYNAMICS & SPEAKING BALANCE ────────────────────────
      renderSectionHeading("Speaking Balance & Dynamics");

      checkSpace(75);
      const dynY = doc.y;
      doc.rect(45, dynY, contentWidth, 55).fillAndStroke(BG_CARD, BORDER_CLR);

      const iPct = aj.speakingPercentage?.interviewer ?? rpt.speakingBalance?.interviewerPercentage ?? 0;
      const cPct = aj.speakingPercentage?.candidate ?? rpt.speakingBalance?.candidatePercentage ?? 0;

      doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica")
         .text(`Interviewer Speaking Share: `, 55, dynY + 10)
         .font("Helvetica-Bold").text(`${iPct}% (${formatTime(aj.speakingTime?.interviewer)})`, 180, dynY + 10)
         .font("Helvetica").text(`Candidate Speaking Share: `, 300, dynY + 10)
         .font("Helvetica-Bold").text(`${cPct}% (${formatTime(aj.speakingTime?.candidate)})`, 430, dynY + 10)
         .font("Helvetica").text(`Interviewer Turn Count: `, 55, dynY + 26)
         .font("Helvetica-Bold").text(`${aj.turns?.interviewer ?? 0} turns`, 180, dynY + 26)
         .font("Helvetica").text(`Avg Interviewer Turn: `, 300, dynY + 26)
         .font("Helvetica-Bold").text(`${aj.turns?.avgInterviewerDuration ?? 0} seconds`, 430, dynY + 26);

      if (rpt.speakingBalance?.assessment) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Oblique")
           .text(`Assessment: ${rpt.speakingBalance.assessment}`, 55, dynY + 40, { width: contentWidth - 20 });
      }

      doc.y = dynY + 64;

      // ── INTERVIEW TIMELINE ────────────────────────────────────────────────
      if (aj.timeline && aj.timeline.length > 0) {
        renderSectionHeading("Interview Timeline & Structure");
        checkSpace(60);

        aj.timeline.slice(0, 6).forEach((item) => {
          checkSpace(18);
          const timeTag = item.startTime != null ? `[${formatTime(item.startTime)}] ` : "";
          doc.fillColor(PRIMARY).fontSize(8).font("Helvetica-Bold").text(timeTag, 55, doc.y, { continued: true });
          doc.fillColor(TEXT_MAIN).font("Helvetica").text(`${item.milestone} - ${item.description}`);
          doc.moveDown(0.2);
        });
      }

      // ── FULL INTERVIEW TRANSCRIPT ──────────────────────────────────────────
      if (segments && segments.length > 0) {
        renderSectionHeading("Full Interview Transcript");
        segments.forEach((seg) => {
          checkSpace(28);
          const speakerLabel = (seg.speaker_type || seg.speaker || "speaker").toUpperCase();
          const timeTag = seg.start_time != null ? ` [${formatTime(seg.start_time)}]` : "";
          const isInterviewer = speakerLabel.includes("INTERVIEWER");

          doc.fillColor(isInterviewer ? PRIMARY : "#10B981").fontSize(8.5).font("Helvetica-Bold")
             .text(`${speakerLabel}${timeTag}: `, 45, doc.y);
          doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica")
             .text(seg.text || seg.transcript_text || "", 45, doc.y, { width: contentWidth, lineGap: 2 });
          doc.moveDown(0.4);
        });
      }

      // ── FOOTERS ON ALL PAGES ──────────────────────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        doc.strokeColor(BORDER_CLR).lineWidth(0.5)
           .moveTo(45, doc.page.height - 42)
           .lineTo(45 + contentWidth, doc.page.height - 42)
           .stroke();

        doc.fontSize(7).font("Helvetica").fillColor(TEXT_MUTED)
           .text(
             "Private Interviewer Coaching Report • Confidential • AI Interview Platform",
             45,
             doc.page.height - 35,
             { width: contentWidth - 80 }
           )
           .text(
             `Page ${i + 1} of ${range.count}`,
             45 + contentWidth - 75,
             doc.page.height - 35,
             { align: "right", width: 75 }
           );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInterviewerReportPdf,
};
