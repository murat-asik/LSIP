const assert=require('node:assert/strict');
const {evaluateRules,compileSigma}=require('../dist/main/modules/ioc-scanner/rule-engine');
const records=[{id:1,EventID:4688,Provider:'Security',Image:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',CommandLine:'powershell.exe -EncodedCommand harmless'}, {id:2,EventID:4688,Provider:'Security',Image:'C:\\Windows\\notepad.exe',CommandLine:'notepad.exe'}, {id:3,EventID:3,Provider:'Microsoft-Windows-Sysmon',Image:'powershell.exe',CommandLine:'powershell.exe -EncodedCommand harmless'}];
const rule=`title: Fixture
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: '\\powershell.exe'
    CommandLine|contains:
      - '-EncodedCommand'
      - '-e '
  condition: selection
`;
assert.deepEqual(evaluateRules('Sigma',rule,records).matchedEvents.map(r=>r.id),[1]);
assert.deepEqual(evaluateRules('Hunt','EventID=4688 AND CommandLine MATCHES ".*powershell.*"',records).matchedEvents.map(r=>r.id),[1]);
assert.deepEqual(evaluateRules('Hunt','(EventID=4688 AND NOT Image CONTAINS "powershell") OR EventID=3',records).matchedEvents.map(r=>r.id),[2,3]);
assert.equal(evaluateRules('IOC','notepad.exe',records).matchesCount,1);
assert.throws(()=>evaluateRules('Hunt','EventID=4688; DELETE FROM events',records));
assert.throws(()=>compileSigma(rule.replace('Image|endswith','Image|unsupported')));
assert.throws(()=>compileSigma(rule.replace('condition: selection','condition: missing')));
assert.equal(evaluateRules('Sigma',rule,[]).matchesCount,0);
assert.equal(evaluateRules('Sigma',rule.replace('condition: selection','condition: all of them'),records).matchesCount,1);
assert.throws(()=>compileSigma('a: &a [*a, *a]\ndetection: *a'));
console.log('10 real rule-engine assertions passed');

