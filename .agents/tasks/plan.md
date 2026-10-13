# Implementation Plan

## Overview

This plan addresses 4 critical bugs in the AI Interview Platform:

1. **Authorization Bug**: Incorrect candidate role check in `getCandidateReport` 
2. **Missing Candidate Post-Interview Route**: No persistent URL for candidates to access reports
3. **PDF Generation Issues**: Data access problems preventing successful downloads
4. **Zero Scores**: AI scoring failures due to API errors and validation issues

## Implementation Items

- [ ] 1. Fix authorization bug in getCandidateReport function (server/src/controllers/report.controller.js lines 81-84).
      Remove the `req.user.role === "candidate"` check since candidates authenticate via join tokens only, not user accounts.
      Files: server/src/controllers/report.controller.js
      Verify: Test GET /api/interviews/:id/candidate-report with interviewer JWT and GET /api/interviews/public/:token/candidate-report with token — both should work correctly without authentication errors.

- [ ] 2. Add dedicated candidate dashboard route for persistent report access via join token.
      Create /candidate/dashboard/:token route that reuses CandidateEndScreen logic but allows bookmarking.
      Files: client/src/constants/routes.js, client/src/App.jsx, client/src/pages/CandidateDashboard.jsx, client/src/components/interview/CandidateEndScreen.jsx
      Verify: Navigate to /candidate/dashboard/:token with valid completed interview token — report displays without login, PDF download works.

- [ ] 3. Improve PDF generation error handling and data validation in PDF services.
      Add null-safe access and validation for report_json fields before attempting PDF generation.
      Files: server/src/services/pdf/pdf.service.js, server/src/services/pdf/candidatePdf.service.js, server/src/services/pdf/interviewerPdf.service.js
      Verify: Test PDF downloads in various report states (processing, malformed data, complete) — should show clear error messages or generate successfully.

- [ ] 4. Fix zero score issues in AI scoring pipeline through better error handling and retry logic.
      Enhance Groq API error handling, add validation for malformed responses, implement retry with exponential backoff.
      Files: server/src/services/ai/groq.service.js, server/src/services/ai/candidateAnalysis.service.js, server/src/services/report/report.service.js
      Verify: Generate reports for interviews with substantial transcript data — should produce non-zero scores, server logs show proper error handling and retry behavior.

## Verification Approach

Since no automated test framework is configured, verification requires manual testing:

1. Start server: `cd server && npm run dev` 
2. Start client: `cd client && npm run dev`
3. Test each API endpoint and UI flow
4. Check server logs for error handling
5. Verify complete end-to-end interview and reporting workflow

## Dependencies

- Items 1-4 are independent and can be implemented in parallel
- Final integration testing requires all fixes to be complete
- No external system changes required

## Security Considerations

- Authorization fix maintains proper access control between interviewers and candidates
- Public candidate routes remain properly secured via join token validation
- PDF access maintains same security model as report access

## Ambiguities/Missing Information

- No specific Groq API rate limits or retry configuration documented
- PDF generation performance with large transcript data not characterized  
- No test data available for comprehensive edge case validation