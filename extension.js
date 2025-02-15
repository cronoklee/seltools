const vscode = require('vscode');

// REMOVES LINE BREAKS AND FORMATS CSS:
function cssFormat(str) {
	return str
		.replace(/[\n\r]+/g, '')
		.replace(/\s{2,10}/g, ' ')
		.replace(/: /g, ':')
		.replace(/;\}/g, '; }')
		.replace(/\}/g, '}\n');
}

// SWAPS SINGLE AND DOUBLE QUOTES IN SELECTED TEXT:
function swapQuotes(str) {
	return str
		.replace(/\['(.*?)'\]/g, '["$1"]') // Swap arrays to double quotes first to ensure they’re always single quotes later
		.replace(/'/g, '~~')
		.replace(/"/g, "'")
		.replace(/~~/g, '"');
}

// COUNTS WORDS AND CHARACTERS IN SELECTED TEXT:
function countWordsAndCharacters(text) {
	const wordCount = text.match(/\b\w+\b/g)?.length || 0;
	const charCount = text.length;
	var bytes = Buffer.byteLength(text, 'utf8');
	// CONVERT BYTES TO KB OR MB IF APPROPRIATE
	let size;
	if (bytes < 1024) size = `${bytes} bytes`;
	else if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(2)} KB`;
	else size = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `SELTOOLS COUNT:\nWords: ${wordCount}\nCharacters: ${charCount}\nLines: ${text.split(/\r\n|\r|\n/).length}\nSize: ${size}`;
}

// TOGGLES BETWEEN ALL UPPER, ALL LOWER, FIRST WORD CAPITALISED, ALL WORDS CAPITALISED:
function toggleCase(str) {
	if (str === str.toUpperCase()) return str.toLowerCase();
	if (str === str.toLowerCase()) return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	if (str === str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()) return str.replace(/\b\w/g, c => c.toUpperCase());
	return str.toUpperCase();
}

// WRAPS SELECTED TEXT IN CHOSEN CHARACTERS:
async function wrapText() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	// HTML tags (appear first in list)
	const htmlTags = [
		{ label: "<p>", value: "p" },
		{ label: "<strong>", value: "strong" },
		{ label: "<b>", value: "b" },
		{ label: "<em>", value: "em" },
		{ label: "<i>", value: "i" },
		{ label: "<h1>", value: "h1" },
		{ label: "<h2>", value: "h2" },
		{ label: "<h3>", value: "h3" },
		{ label: "<div>", value: "div" },
		{ label: "<span>", value: "span" },
		{ label: "<a>", value: "a" },
		{ label: "<button>", value: "button" },
		{ label: "<img>", value: "img", selfClosing: true },
		{ label: "<input>", value: "input", selfClosing: true },
		{ label: "<br>", value: "br", selfClosing: true },
		{ label: "<hr>", value: "hr", selfClosing: true },
		{ label: "<form>", value: "form" },
		{ label: "<script>", value: "script" },
		{ label: "<link>", value: "link" },
		{ label: "<meta>", value: "meta" }
	];

	// Wrapping presets (Updated formatting for better sorting)
	const presets = [
		{ label: ' " "', value: ['"', '"'] },
		{ label: " ' '", value: ["'", "'"] },
		{ label: " []", value: ["[", "]"] },
		{ label: " {}", value: ["{", "}"] },
		{ label: " ()", value: ["(", ")"] },
		{ label: " <>", value: ["<", ">"] },
		{ label: " Custom (Type Your Own)", value: "custom" }
	];

	// Combine HTML tags & presets
	const options = [...presets, ...htmlTags];

	// Show QuickPick list
	const selected = await vscode.window.showQuickPick(
		options.map(opt => opt.label),
		{ placeHolder: "Choose wrapping characters or an HTML tag", ignoreFocusOut: true }
	);

	if (!selected) return;

	let chosenWrap;
	let attributes = "";
	let isSelfClosing = false;

	// If an HTML tag is selected, ask for attributes
	const selectedTag = htmlTags.find(t => t.label === selected);
	if (selectedTag) {
		const tag = selectedTag.value;
		isSelfClosing = !!selectedTag.selfClosing;

		// DEFINE ATTRIBUTE OPTIONS:
		const commonAttributes = [
			{ label: "class", placeholder: "my-class" },
			{ label: "id", placeholder: "unique-id" },/*
			{ label: "href", placeholder: "https://example.com" },
			{ label: "src", placeholder: "image.jpg" }, */
			{ label: "alt", placeholder: "description" },
			{ label: "type", placeholder: "text" },
			{ label: "style", placeholder: "color: red;" },
			{ label: "data-*", placeholder: "data-custom='value'" },
			{ label: " Custom (Enter Your Own)", placeholder: "attribute=value" }
		];
		const defaultAttributes = {
			"img": ["src", "alt"],
			"a": ["href"],
			"input": ["type"],
			"form": ["action", "method"],
			"script": ["src"],
			"link": ["rel", "href"],
			"meta": ["name", "content"]
		};

		// Allow selecting multiple attributes
		var selectedAttributes = await vscode.window.showQuickPick(
			commonAttributes.map(attr => attr.label),
			{ placeHolder: 'Select attributes (or leave empty)', canPickMany: true, ignoreFocusOut: true }
		);
		// Merge default attributes with user-selected ones
		const tagDefaults = defaultAttributes[tag] || [];
		selectedAttributes = [...new Set([...tagDefaults, ...(selectedAttributes || [])])];

		if (selectedAttributes && selectedAttributes.length > 0) {
			for (let attribute of selectedAttributes) {
				let attrName = attribute;
				if (attribute === " Custom (Enter Your Own)") {
					attrName = await vscode.window.showInputBox({
						prompt: "Enter custom attribute (e.g., data-user='123')",
						placeHolder: `e.g., attribute=\"value\"`
					});
					if (!attrName) continue;
				}

				const lineText = editor.document.lineAt(editor.selection.active.line).text;
				const quoteType = lineText.includes('"') && !lineText.includes("'") ? "'" : '"';
				attributes += ` ${attrName}=${quoteType}${quoteType}`; // Use opposite quote type
			}
		}
		chosenWrap = isSelfClosing ? [`<${tag}${attributes} />`] : [`<${tag}${attributes}>`, `</${tag}>`];
	}
	// Custom wrapping input
	else if (selected === " Custom (Type Your Own)") {
		const customInput = await vscode.window.showInputBox({
			prompt: 'Enter custom wrapping characters (e.g., {{  }} or <!-- -->)',
			placeHolder: "e.g., ## or <<< >>>"
		});
		if (!customInput) return;

		chosenWrap = [customInput, customInput];
	} else {
		chosenWrap = presets.find(p => p.label === selected).value;
	}

	// Apply wrapping to selected text and move caret inside first attribute
	await editor.edit(editBuilder => {
		editor.selections.forEach(selection => {
			const text = editor.document.getText(selection) || '';

			// Insert wrapped text
			const newText = isSelfClosing ? chosenWrap[0] : chosenWrap[0] + text + chosenWrap[1];
			editBuilder.replace(selection, newText);
		});
	});

	// MOVE CARET INSIDE THE FIRST ATTRIBUTE'S QUOTES
	const newPosition = editor.selection.active;
	const lineText = editor.document.lineAt(newPosition.line).text;
	const firstAttrIndex = lineText.indexOf('=""') !== -1 ? lineText.indexOf('=""') : lineText.indexOf("=''");
	if (firstAttrIndex !== -1) {
		const cursorPosition = newPosition.with(undefined, firstAttrIndex + 2);
		editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
	}

}







////////////////////////////////////////// ACTIVATE & DEACTIVATE //////////////////////////////////////////

function activate(context) {

	// SWAP QUOTES:
	context.subscriptions.push(vscode.commands.registerCommand('seltools.swapQuotes', async function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = editor.document;
		let updatedSelections = [];

		editor.selections.forEach(selection => {
			let start = selection.start;
			let end = selection.end;
			let text = document.getText(selection);

			// Expand selection if empty or does not contain quotes
			if (selection.isEmpty || (!text.includes('"') && !text.includes("'"))) {
				let quoteChar = null;

				// Move left to find the first quote
				while (start.character > 0) {
					let charBefore = document.getText(new vscode.Range(start.translate(0, -1), start));
					if (charBefore === '"' || charBefore === "'") {
						quoteChar = charBefore; // Store the found quote type
						start = start.translate(0, -1);
						break;
					}
					start = start.translate(0, -1);
				}

				// Move right to find the matching closing quote
				while (end.character < document.lineAt(end.line).text.length) {
					let charAfter = document.getText(new vscode.Range(end, end.translate(0, 1)));
					if (charAfter === quoteChar) { // Match the same quote type
						end = end.translate(0, 1);
						break;
					}
					end = end.translate(0, 1);
				}
			}

			updatedSelections.push(new vscode.Selection(start, end));
		});

		// Apply text replacements
		const success = await editor.edit(textEdit => {
			updatedSelections.forEach(selection => {
				const text = document.getText(selection);
				textEdit.replace(selection, swapQuotes(text));
			});
		});

		if (success) {
			vscode.window.showInformationMessage('Quotes have been swapped');
		}
	}));


	// CSS FORMAT:
	context.subscriptions.push(vscode.commands.registerCommand('seltools.cssFormat', async function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		try {
			const clipboardText = await vscode.env.clipboard.readText();
			const selections = editor.selections;

			editor.edit(textEdit => {
				selections.forEach((selection) => {
					textEdit.replace(selection, cssFormat(clipboardText));
				});
			}).then(success => {
				if (success) {
					vscode.window.showInformationMessage('Pasted with line breaks removed!');
				}
			});
		} catch (error) {
			vscode.window.showErrorMessage('Error reading clipboard text');
		}
	}));

	// WRAP TEXT:
	context.subscriptions.push(vscode.commands.registerCommand('seltools.wrapText', wrapText));

	// COUNT WORDS AND CHARACTERS:
	context.subscriptions.push(vscode.commands.registerCommand('seltools.countWordsChars', function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const text = editor.document.getText(editor.selection);
		const result = countWordsAndCharacters(text);
		vscode.window.showInformationMessage(result, { modal: true }, "Copy").then(selection => {
			if (selection === "Copy") {
				vscode.env.clipboard.writeText(result);
				vscode.window.showInformationMessage("Copied to clipboard!");
			}
		});
	}));

	// TOGGLE CASE:
	context.subscriptions.push(vscode.commands.registerCommand('seltools.toggleCase', function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		const selections = editor.selections;

		editor.edit(textEdit => {
			selections.forEach(selection => {
				if (!selection.isEmpty) {
					const text = editor.document.getText(selection);
					textEdit.replace(selection, toggleCase(text));
				}
			});
		});
	}));
}

function deactivate() {
	vscode.window.showInformationMessage('Selection tools has been deactivated');
}

module.exports = {
	activate,
	deactivate
};
