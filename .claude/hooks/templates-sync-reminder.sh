#!/bin/bash
# PostToolUse hook: remind about templates.json sync when template files are edited

# Read the tool result from stdin (JSON with tool_name, tool_input, etc.)
INPUT=$(cat)

# Extract file path from the JSON input
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    path = data.get('tool_input', {}).get('file_path', '')
    print(path)
except:
    print('')
" 2>/dev/null)

# Check if the edited file is a template or DS file that needs sync
if echo "$FILE_PATH" | grep -qE '(template\.json|index\.tpl|ds\.json|index\.ds\.css\.twig)'; then
    # Determine what was edited
    if echo "$FILE_PATH" | grep -q 'template\.json'; then
        echo "Reminder: template.json changed — ensure the corresponding entry in templates.json is also updated."
    elif echo "$FILE_PATH" | grep -q 'index\.tpl'; then
        echo "Reminder: .tpl file changed — if template metadata changed, update template.json and templates.json too."
    elif echo "$FILE_PATH" | grep -q 'ds\.json'; then
        echo "Reminder: ds.json changed — regenerate CSS: node app/scripts/render-ds-css.mjs {company} --out app/src/generated-css-from-twig/{company}-ds.css"
    elif echo "$FILE_PATH" | grep -q 'index\.ds\.css\.twig'; then
        echo "Reminder: Main twig changed — run twig-sync for company twigs (minimal, avito, pik)."
    fi
fi
