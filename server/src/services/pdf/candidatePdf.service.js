const PDFDocument = require("pdfkit");

const formatTime = (totalSeconds) => {
  if (totalSeconds == null || isNaN(totalSeconds)) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Generate a professional, multi-page Candidate Interview Report PDF.
 *
 * @param {Object} opts
 * @param {Object} opts.interview - Interview row from DB
 * @param {Object} opts.report - Candidate report row with report_json
 * @param {Object|null} opts.analytics - Analytics row with analytics_json
 * @returns {Promise<Buffer>} PDF Buffer
 */
const generateCandidateReportPdf = ({ interview, report, analytics, segments }) => {
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

      // Color Palette
      const PRIMARY = "#5B32E8";     // Deep Violet
      const SECONDARY = "#1E1B2E";   // Dark Slate
      const TEXT_MAIN = "#1A1A24";   // Main Text
      const TEXT_MUTED = "#555566";  // Muted Text
      const BG_CARD = "#F8F7FC";     // Card Background
      const BORDER_CLR = "#E5E2F0";  // Border
      const GREEN = "#10B981";       // Success/Strength
      const AMBER = "#F59E0B";       // Warning
      const RED = "#EF4444";         // Weakness

      // Helper: Check space and auto-page
      const checkSpace = (neededHeight) => {
        if (doc.y + neededHeight > doc.page.height - 55) {
          doc.addPage();
        }
      };

      // Helper: Section Heading
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
         .text("CANDIDATE INTERVIEW REPORT", 60, 68);

      doc.fillColor("#A5A0C8").fontSize(8.5).font("Helvetica")
         .text(`Interview ID: ${interview.id}`, 60, 92)
         .text(`Generated: ${new Date().toLocaleDateString()}`, 45 + contentWidth - 140, 92, { align: "right", width: 125 });

      doc.y = 125;

      // ── CANDIDATE & INTERVIEW META ─────────────────────────────────────────
      doc.rect(45, doc.y, contentWidth, 48).fillAndStroke(BG_CARD, BORDER_CLR);
      const metaY = doc.y + 10;

      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
         .text("CANDIDATE NAME", 60, metaY)
         .text("TARGET ROLE", 220, metaY)
         .text("DURATION", 380, metaY);

      doc.fillColor(TEXT_MAIN).fontSize(10).font("Helvetica-Bold")
         .text(interview.candidate_name || "Candidate", 60, metaY + 12)
         .text(interview.job_description ? interview.job_description.slice(0, 30) + (interview.job_description.length > 30 ? "…" : "") : "Technical Role", 220, metaY + 12)
         .text(aj.duration?.formatted || (interview.duration_seconds ? formatTime(interview.duration_seconds) : "Completed"), 380, metaY + 12);

      doc.y = metaY + 46;

      // ── EXECUTIVE SUMMARY & OVERALL SCORE ──────────────────────────────────
      renderSectionHeading("Executive Summary & Assessment");

      const scoreBoxWidth = 110;
      const summaryBoxWidth = contentWidth - scoreBoxWidth - 12;
      const startBoxY = doc.y;

      // Score Box
      doc.rect(45, startBoxY, scoreBoxWidth, 90).fillAndStroke(PRIMARY, PRIMARY);
      doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold").text("OVERALL SCORE", 45, startBoxY + 14, { align: "center", width: scoreBoxWidth });
      doc.fillColor("#FFFFFF").fontSize(26).font("Helvetica-Bold").text(`${rpt.overallScore ?? 0}`, 45, startBoxY + 28, { align: "center", width: scoreBoxWidth });
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica").text("/ 100", 45, startBoxY + 58, { align: "center", width: scoreBoxWidth });
      doc.fillColor("#E0D8FF").fontSize(8.5).font("Helvetica-Bold").text(rpt.recommendation || "Evaluated", 45, startBoxY + 70, { align: "center", width: scoreBoxWidth });

      // Summary Text Box
      doc.rect(45 + scoreBoxWidth + 12, startBoxY, summaryBoxWidth, 90).fillAndStroke(BG_CARD, BORDER_CLR);
      doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica")
         .text(rpt.summary || "Comprehensive candidate performance evaluation based on interview transcript evidence.", 45 + scoreBoxWidth + 24, startBoxY + 14, {
           width: summaryBoxWidth - 24,
           lineGap: 3,
         });

      doc.y = startBoxY + 100;

      // ── SCORECARD BREAKDOWN ────────────────────────────────────────────────
      renderSectionHeading("Performance Scorecard");

      const dimensions = [
        { label: "Technical Skills", score: rpt.technicalEvaluation?.score ?? 0 },
        { label: "Problem Solving", score: rpt.problemSolving?.score ?? 0 },
        { label: "Communication", score: rpt.communication?.score ?? 0 },
        { label: "Behavioral Performance", score: rpt.behavioralPerformance?.score ?? 0 },
        { label: "Job Fit Match", score: rpt.jobFit?.score ?? 0 },
      ];

      const barStartX = 200;
      const maxBarWidth = contentWidth - 190;

      dimensions.forEach((dim) => {
        checkSpace(24);
        const currY = doc.y;

        doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica-Bold")
           .text(dim.label, 50, currY + 3, { width: 140 });

        // Progress bar background
        doc.rect(barStartX, currY + 4, maxBarWidth, 10).fill("#EAE8F2");

        // Filled bar
        const fillWidth = Math.max(2, (dim.score / 100) * maxBarWidth);
        const barColor = dim.score >= 75 ? GREEN : dim.score >= 50 ? AMBER : RED;
        doc.rect(barStartX, currY + 4, fillWidth, 10).fill(barColor);

        doc.fillColor(TEXT_MAIN).fontSize(9).font("Helvetica-Bold")
           .text(`${dim.score}/100`, barStartX + maxBarWidth + 10, currY + 3);

        doc.y = currY + 20;
      });

      // ── STRENGTHS & AREAS FOR IMPROVEMENT ──────────────────────────────────
      renderSectionHeading("Strengths & Areas For Improvement");

      const colWidth = (contentWidth - 12) / 2;
      const startColY = doc.y;

      // Pre-calculate heights
      const strengthsList = [
        ...(rpt.technicalEvaluation?.strengths || []),
        ...(rpt.problemSolving?.strengths || []),
      ].slice(0, 4);
      if (strengthsList.length === 0) strengthsList.push("Solid conversational participation and communication.");

      const improvementList = (rpt.areasForImprovement || []).slice(0, 4);
      if (improvementList.length === 0) improvementList.push("Continue expanding depth in complex system trade-offs.");

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
      doc.fillColor(GREEN).fontSize(9).font("Helvetica-Bold").text("KEY STRENGTHS", 55, startColY + 10);

      strY = startColY + 26;
      strengthsList.forEach((s) => {
        doc.fillColor(GREEN).fontSize(8).font("Helvetica-Bold").text("✓", 55, strY);
        doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica").text(s, 67, strY, { width: colWidth - 25, lineGap: 2 });
        strY += Math.max(18, doc.heightOfString(s, { width: colWidth - 25 }) + 4);
      });

      doc.rect(45 + colWidth + 12, startColY, colWidth, colHeight).fillAndStroke(BG_CARD, BORDER_CLR);
      doc.fillColor(AMBER).fontSize(9).font("Helvetica-Bold").text("AREAS FOR IMPROVEMENT", 55 + colWidth + 12, startColY + 10);

      impY = startColY + 26;
      improvementList.forEach((imp) => {
        doc.fillColor(AMBER).fontSize(8).font("Helvetica-Bold").text("•", 55 + colWidth + 12, impY);
        doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica").text(imp, 67 + colWidth + 12, impY, { width: colWidth - 25, lineGap: 2 });
        impY += Math.max(18, doc.heightOfString(imp, { width: colWidth - 25 }) + 4);
      });

      doc.y = startColY + colHeight + 12;

      // ── DETAILED DIMENSION EVALUATIONS (WITH EVIDENCE) ──────────────────────
      renderSectionHeading("Detailed Evaluations & Evidence");

      const renderDimensionDetail = (title, data) => {
        if (!data) return;
        const strengthsText = data.strengths?.length > 0 ? `Strengths: ${data.strengths.join(", ")}` : "";
        const weaknessesText = data.weaknesses?.length > 0 ? `Weaknesses: ${data.weaknesses.join(", ")}` : "";
        const ev = data.evidence && data.evidence.length > 0 ? data.evidence[0] : null;
        const timeRange = ev?.startTime != null ? `[${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}] ` : "";
        const evidenceText = ev ? `Evidence: ${timeRange}${ev.claim || ev.quote || ""}` : "";

        const sH = strengthsText ? doc.heightOfString(strengthsText, { width: contentWidth - 20 }) : 0;
        const wH = weaknessesText ? doc.heightOfString(weaknessesText, { width: contentWidth - 20 }) : 0;
        const eH = evidenceText ? doc.heightOfString(evidenceText, { width: contentWidth - 20 }) : 0;
        const cardH = Math.max(50, 20 + (sH ? sH + 4 : 0) + (wH ? wH + 4 : 0) + (eH ? eH + 4 : 0) + 8);

        checkSpace(cardH + 10);
        const cardY = doc.y;

        doc.rect(45, cardY, contentWidth, cardH).fillAndStroke(BG_CARD, BORDER_CLR);
        doc.fillColor(PRIMARY).fontSize(9.5).font("Helvetica-Bold")
           .text(`${title} (Score: ${data.score ?? 0}/100)`, 55, cardY + 8, { width: contentWidth - 20 });

        let curY = cardY + 22;
        if (strengthsText) {
          doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica")
             .text(strengthsText, 55, curY, { width: contentWidth - 20, lineGap: 1 });
          curY += sH + 4;
        }
        if (weaknessesText) {
          doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica")
             .text(weaknessesText, 55, curY, { width: contentWidth - 20, lineGap: 1 });
          curY += wH + 4;
        }
        if (evidenceText) {
          doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Oblique")
             .text(evidenceText, 55, curY, { width: contentWidth - 20 });
        }

        doc.y = cardY + cardH + 8;
      };

      renderDimensionDetail("Technical Evaluation", rpt.technicalEvaluation);
      renderDimensionDetail("Problem Solving & Logic", rpt.problemSolving);
      renderDimensionDetail("Communication & Clarity", rpt.communication);
      renderDimensionDetail("Behavioral & Collaboration", rpt.behavioralPerformance);

      // ── QUESTION & ANSWER EVIDENCE ─────────────────────────────────────────
      if (rpt.questionAnswerAnalysis && rpt.questionAnswerAnalysis.length > 0) {
        renderSectionHeading("Key Question & Answer Analysis");

        rpt.questionAnswerAnalysis.slice(0, 4).forEach((qa, i) => {
          checkSpace(65);
          const qaY = doc.y;
          doc.rect(45, qaY, contentWidth, 58).fillAndStroke(BG_CARD, BORDER_CLR);

          const timeTag = qa.startTime != null ? ` (${formatTime(qa.startTime)})` : "";
          doc.fillColor(PRIMARY).fontSize(8.5).font("Helvetica-Bold")
             .text(`Q${i + 1}: ${qa.question}${timeTag}`, 55, qaY + 8, { width: contentWidth - 20 });

          doc.fillColor(TEXT_MAIN).fontSize(8).font("Helvetica")
             .text(`A: "${qa.answer}"`, 55, qaY + 22, { width: contentWidth - 20, lineGap: 2 });

          doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Oblique")
             .text(`Evaluation: ${qa.evaluation}`, 55, qaY + 42, { width: contentWidth - 20 });

          doc.y = qaY + 65;
        });
      }

      // ── JOB FIT & SKILLS MATCH ─────────────────────────────────────────────
      if (rpt.jobFit) {
        renderSectionHeading("Job Fit & Skills Verification");
        checkSpace(65);
        const jfY = doc.y;
        doc.rect(45, jfY, contentWidth, 60).fillAndStroke(BG_CARD, BORDER_CLR);

        doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica-Bold")
           .text(`Demonstrated Matching Skills:`, 55, jfY + 8)
           .font("Helvetica").text(rpt.jobFit.matchingSkills?.join(", ") || "None clearly recorded", 210, jfY + 8, { width: contentWidth - 170 });

        doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica-Bold")
           .text(`Resume Only (Unverified):`, 55, jfY + 24)
           .font("Helvetica").text(rpt.jobFit.resumeOnlySkills?.join(", ") || "None", 210, jfY + 24, { width: contentWidth - 170 });

        doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica-Bold")
           .text(`Missing / Unexplored Skills:`, 55, jfY + 40)
           .font("Helvetica").text(rpt.jobFit.missingSkills?.join(", ") || "None", 210, jfY + 40, { width: contentWidth - 170 });

        doc.y = jfY + 68;
      }

      // ── CONVERSATIONAL & TIMELINE ANALYTICS ────────────────────────────────
      if (aj.speakingTime || aj.timeline?.length > 0) {
        renderSectionHeading("Interview Dynamics & Timeline");

        checkSpace(80);
        const dynY = doc.y;
        doc.rect(45, dynY, contentWidth, 45).fillAndStroke(BG_CARD, BORDER_CLR);

        doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica")
           .text(`Candidate Speaking Share: `, 55, dynY + 10)
           .font("Helvetica-Bold").text(`${aj.speakingPercentage?.candidate ?? 0}% (${formatTime(aj.speakingTime?.candidate)})`, 180, dynY + 10)
           .font("Helvetica").text(`Candidate Turns: `, 300, dynY + 10)
           .font("Helvetica-Bold").text(`${aj.turns?.candidate ?? 0} turns`, 390, dynY + 10)
           .font("Helvetica").text(`Avg Candidate Turn: `, 55, dynY + 26)
           .font("Helvetica-Bold").text(`${aj.turns?.avgCandidateDuration ?? 0} seconds`, 180, dynY + 26)
           .font("Helvetica").text(`Language Distribution: `, 300, dynY + 26)
           .font("Helvetica-Bold").text(`${aj.languages?.candidate?.primaryLanguage || "English"}`, 415, dynY + 26);

        doc.y = dynY + 54;

        if (aj.timeline && aj.timeline.length > 0) {
          checkSpace(55);
          doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica-Bold").text("CHRONOLOGICAL MILESTONES:", 50, doc.y);
          doc.moveDown(0.4);

          aj.timeline.slice(0, 6).forEach((item) => {
            checkSpace(18);
            const timeTag = item.startTime != null ? `[${formatTime(item.startTime)}] ` : "";
            doc.fillColor(PRIMARY).fontSize(8).font("Helvetica-Bold").text(timeTag, 55, doc.y, { continued: true });
            doc.fillColor(TEXT_MAIN).font("Helvetica").text(`${item.milestone} - ${item.description}`);
            doc.moveDown(0.2);
          });
        }
      }

      // ── FULL INTERVIEW TRANSCRIPT ──────────────────────────────────────────
      if (segments && segments.length > 0) {
        renderSectionHeading("Full Interview Transcript");
        segments.forEach((seg) => {
          checkSpace(28);
          const speakerLabel = (seg.speaker_type || seg.speaker || "speaker").toUpperCase();
          const timeTag = seg.start_time != null ? ` [${formatTime(seg.start_time)}]` : "";
          const isInterviewer = speakerLabel.includes("INTERVIEWER");

          doc.fillColor(isInterviewer ? PRIMARY : GREEN).fontSize(8.5).font("Helvetica-Bold")
             .text(`${speakerLabel}${timeTag}: `, 45, doc.y);
          doc.fillColor(TEXT_MAIN).fontSize(8.5).font("Helvetica")
             .text(seg.text || seg.transcript_text || "", 45, doc.y, { width: contentWidth, lineGap: 2 });
          doc.moveDown(0.4);
        });
      }

      // ── AI DISCLAIMER (FOOTER ON EACH PAGE) ───────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Footer Divider
        doc.strokeColor(BORDER_CLR).lineWidth(0.5)
           .moveTo(45, doc.page.height - 42)
           .lineTo(45 + contentWidth, doc.page.height - 42)
           .stroke();

        // Disclaimer & Page number
        doc.fontSize(7).font("Helvetica").fillColor(TEXT_MUTED)
           .text(
             "AI-generated evaluation intended to assist human review. Does not constitute an automated hiring decision.",
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
  generateCandidateReportPdf,
};
