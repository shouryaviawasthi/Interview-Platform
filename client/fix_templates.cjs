const fs = require('fs');
const path = require('path');

// Fix all broken template literal patterns in JSX files written via PowerShell
function fixFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // 1. Fix className={mb-2 inline-flex rounded-xl border px-3 py-1 text-xs font-bold   }
  //    The pattern is: className={STATIC_CLASSES ${dynamicVar} MORE_STATIC} 
  //    They become: className={STATIC ${...} MORE} with the ${ stripped to just { 
  //    Or sometimes: className={STATIC_CLASSES   } (with empty dynamic)
  
  // Replace patterns like: className={someClasses ${recStyle.bg} ${recStyle.text} ${recStyle.border}}
  // which became: className={someClasses    }  (empty or broken)
  
  // Pattern: {mb-2 inline-flex rounded-xl border px-3 py-1 text-xs font-bold   }
  code = code.replace(
    /className=\{mb-2 inline-flex rounded-xl border px-3 py-1 text-xs font-bold\s+\}/g,
    'className={"mb-2 inline-flex rounded-xl border px-3 py-1 text-xs font-bold " + recStyle.bg + " " + recStyle.text + " " + recStyle.border}'
  );

  // Same pattern in CandidateEndScreen - mb-3 version
  code = code.replace(
    /className=\{mb-3 inline-flex rounded-xl border px-4 py-1\.5 text-sm font-bold\s+\}/g,
    'className={"mb-3 inline-flex rounded-xl border px-4 py-1.5 text-sm font-bold " + recStyle.bg + " " + recStyle.text + " " + recStyle.border}'
  );

  // Fix: className={flex gap-2.5 ${chunk.isFinal ? ... } }  - opacity variants
  // Broken as: className={flex gap-2.5 } or similar
  
  // Fix ROUTES template patterns broken as: /interviews//end-dashboard
  code = code.replace(/\/interviews\/\/end-dashboard/g, '/interviews/' + id + '/end-dashboard');
  // These are arrow functions so they should be fine in non-powershell context
  
  // Fix: style={{ width: ${pct}% }} -> style={{ width: pct + "%" }}  (already done)
  
  // Fix any remaining ${...} that got broken to just {...} without the dollar
  // Look for patterns that look like JSX expressions that shouldn't exist as bare identifiers

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Fixed:', filePath);
}

fixFile(path.join(__dirname, 'src/pages/InterviewEndDashboard.jsx'));
fixFile(path.join(__dirname, 'src/components/interview/CandidateEndScreen.jsx'));
console.log('Done!');
