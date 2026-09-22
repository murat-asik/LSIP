"""Copy installed component notices beside the executable and record provenance."""
from importlib.metadata import distributions
from pathlib import Path
import json
import shutil

root = Path(__file__).resolve().parent.parent
source = root / 'tmp' / 'forensic-packages'
destination = root / 'vendor' / 'forensics' / 'lsip-forensics' / 'licenses'
destination.mkdir(parents=True, exist_ok=True)
inventory = []
for distribution in distributions(path=[str(source)]):
    name = distribution.metadata['Name']
    metadata = distribution.metadata
    notices = []
    for file in distribution.files or []:
        if any(word in file.name.lower() for word in ('license', 'copyright', 'notice')):
            original = Path(distribution.locate_file(file))
            if original.is_file():
                relative = Path(name) / Path(str(file))
                if '..' in relative.parts:
                    continue
                target = destination / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(original, target)
                notices.append(str(relative))
    inventory.append({'name': name, 'version': distribution.version,
                      'license': metadata.get('License-Expression') or metadata.get('License'),
                      'urls': metadata.get_all('Project-URL', []), 'notices': notices})
(destination / 'inventory.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
shutil.copyfile(root / 'scripts' / 'forensic-helper.py', destination.parent / 'forensic-helper.py')
