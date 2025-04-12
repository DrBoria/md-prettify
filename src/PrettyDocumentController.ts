import * as vscode from 'vscode';
import * as copyPaste from 'copy-paste';

import { LanguageEntry, HideTextMethod } from './configuration';
import * as pos from './position';
import * as tm from './text-mate';
import { PrettyModel, UpdateDecorationEntry, UpdateDecorationInstanceEntry } from './PrettyModel';

const activeEditorDecorationTimeout = 100;
const updateSelectionTimeout = 20;

function arrayEqual<T>(a1: T[], a2: T[], isEqual: (x: T, y: T) => boolean = ((x, y) => x === y)): boolean {
  if (a1.length != a2.length)
    return false;
  for (let idx = 0; idx < a1.length; ++idx) {
    if (!isEqual(a1[idx], a2[idx]))
      return false;
  }
  return true;
}

class DebounceFunction implements vscode.Disposable {
  private timer?: NodeJS.Timeout = null;
  private callback?: () => void = null;
  constructor(private timeout: number) { }
  public dispose() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  public call(callback: () => void): void {
    this.callback = callback;
    if (this.timer == null) {
      this.timer = setTimeout(() => {
        this.callback();
        this.callback = null;
        this.timer = null;
      }, this.timeout);
    }
  }
}


 
export class PrettyDocumentController implements vscode.Disposable {
  private prettyModel: PrettyModel | null;
  private readonly subscriptions: vscode.Disposable[] = [];
  private currentDecorations: UpdateDecorationEntry[] = [];
  private updateActiveEditor = new DebounceFunction(activeEditorDecorationTimeout);
  private updateSelection = new DebounceFunction(updateSelectionTimeout);
  private document: vscode.TextDocument | null;
  private adjustCursorMovement: boolean;
  private debug: boolean;
  private outputChannel: vscode.OutputChannel;

  public constructor(doc: vscode.TextDocument, settings: LanguageEntry, options: { 
    hideTextMethod: HideTextMethod; 
    debug: boolean; 
    textMateGrammar?: tm.IGrammar | null; 
    outputChannel: vscode.OutputChannel;
  }) {
    // Skip initialization for the prettify debug output channel
    if (doc.fileName.includes('.md-prettify')) {
      this.document = doc; // Keep reference for dispose logic if needed
      this.prettyModel = null;
      this.adjustCursorMovement = false;
      this.debug = options.debug;
      this.outputChannel = options.outputChannel;
      console.log(`Skipping PrettyDocumentController initialization for debug channel: ${doc.fileName}`);
      return;
    }

    this.document = doc;
    this.adjustCursorMovement = settings.adjustCursorMovement ?? false;
    this.debug = options.debug;
    this.outputChannel = options.outputChannel;
    const docModel = {
      getText: (r?: vscode.Range) => this.document?.getText(r) ?? '',
      getLine: (n: number) => this.document?.lineAt(n)?.text ?? '',
      getLineRange: (n: number) => this.document?.lineAt(n)?.range ?? new vscode.Range(n,0,n,0),
      getLineCount: () => this.document?.lineCount ?? 0,
      validateRange: (r: vscode.Range) => this.document?.validateRange(r) ?? r,
    }
    this.prettyModel = new PrettyModel(docModel, settings, {
        hideTextMethod: options.hideTextMethod,
        debug: options.debug,
        textMateGrammar: options.textMateGrammar,
        outputChannel: options.outputChannel,
        languageId: doc.languageId,
    });

    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.document && e.document == this.document)
        this.onChangeDocument(e);
    }));

    // setTimeout(() => {
      if (this.document && !this.document.isClosed) {
        this.applyDecorations(this.getEditors(), Array.from(this.prettyModel?.getDecorationsList() ?? []));
      }
    // }, 50);
  }

  public dispose() {
    console.log(`Disposing PrettyDocumentController for ${this.document?.uri}`);
    if (this.prettyModel) {
      const editors = this.getEditors();
      const decorationTypes = this.prettyModel.getAllDecorationTypes();

      editors.forEach(editor => {
        if (editor && editor.document && !editor.document.isClosed) {
          decorationTypes.forEach(decorationType => {
            try {
              if (decorationType) {
                editor.setDecorations(decorationType, []);
              }
            } catch (e) {
              console.error(`Error clearing decoration type ${decorationType?.key || 'unknown'} in editor for ${this.document?.uri}`, e);
            }
          });
        }
      });
      console.log(`Attempted to clear ${decorationTypes.length} decoration types from ${editors.length} editors for ${this.document?.uri}`);
    }

    this.prettyModel?.dispose();

    this.subscriptions.forEach((s) => s.dispose());
    this.subscriptions.length = 0;

    this.updateActiveEditor.dispose();
    this.updateSelection.dispose();

    this.prettyModel = null;
    this.document = null;
    this.currentDecorations = [];
    this.lastSelections.clear();

    console.log(`Finished disposing PrettyDocumentController for ${this.document?.uri}`);
  }

  private getEditors(): vscode.TextEditor[] {
    return vscode.window.visibleTextEditors
      .filter((editor) => editor && editor.document && editor.document.uri === this.document?.uri);
  }

  public gotFocus(editor: vscode.TextEditor) {
    if (!this.prettyModel || !this.document) return;
    this.applyDecorations(this.getEditors(), this.currentDecorations);
  }

  public copyDecorated(editor: vscode.TextEditor): Promise<void> {
    if (!this.prettyModel || !this.document) return Promise.resolve();
    function doCopy(x: any) {
      return new Promise<void>((resolve, reject) => copyPaste.copy(x, (err) => err ? reject(err) : resolve()));
    }
    const copy = editor.selections.map(sel => this.prettyModel.getDecoratedText(sel));
    if (copy.length === 0)
      return Promise.resolve();
    else
      return doCopy(copy.join('\n'))
  }

  private applyActiveEditorDecorations(
    editors: Iterable<vscode.TextEditor>,
    decs: UpdateDecorationEntry[],
    revealRanges?: vscode.Range[],
    prettyCursors?: UpdateDecorationInstanceEntry,
  ): void {
    if (!this.prettyModel || !this.document) return;
    this.updateActiveEditor.call(() => {
      if (!this.prettyModel || !this.document) return;
      try {
        const currentSelections = vscode.window.activeTextEditor?.document?.uri === this.document.uri
                                    ? vscode.window.activeTextEditor.selections
                                    : [];
        const reveal = revealRanges
            || this.prettyModel.revealSelections(currentSelections).ranges

        for (const editor of editors) {
             if (!editor || !editor.document || editor.document.isClosed) continue;

            decs.forEach(d => {
                if (d && d.decoration) {
                    editor.setDecorations(
                        d.decoration,
                        d.ranges
                            .filter(r => reveal.every(s => s.intersection(r) === undefined))
                    )
                } else {
                    console.warn(`Skipping invalid decoration entry in applyActiveEditorDecorations for ${this.document?.uri}`);
                }
            });
        }
      } catch (err) {
        console.error(`Error in applyActiveEditorDecorations callback for ${this.document?.uri}:`, err)
      }
    });
  }

  private applyDecorations(editors: Iterable<vscode.TextEditor>, decs: UpdateDecorationEntry[]) {
    if (!this.prettyModel || !this.document) return;
    this.currentDecorations = decs;
    const activeEditor = vscode.window.activeTextEditor;
    const editorSet = new Set(editors);
    if (activeEditor && activeEditor.document.uri === this.document.uri) {
        editorSet.add(activeEditor);
    }
    this.applyActiveEditorDecorations(Array.from(editorSet), decs);
  }

  private onChangeDocument(event: vscode.TextDocumentChangeEvent) {
    if (!this.prettyModel || !this.document || event.document.uri !== this.document.uri) return;

    const changed = this.prettyModel.applyChanges(event.contentChanges);

    this.prettyModel.recomputeDecorations();

    this.applyDecorations(this.getEditors(), Array.from(this.prettyModel.getDecorationsList()));
  }

  public refresh() {
    if (!this.prettyModel || !this.document) return;
    this.prettyModel.recomputeDecorations();
    this.applyDecorations(this.getEditors(), Array.from(this.prettyModel.getDecorationsList()));
  }

  private lastSelections = new Map<vscode.TextEditor, vscode.Selection[]>();
  public adjustCursor(editor: vscode.TextEditor): null | vscode.Selection[] {
    if (!this.prettyModel || !this.document) return null;
    let updated = false;
    let adjustedSelections: vscode.Selection[] = [];
    let before = this.lastSelections.get(editor);
    if (!before) {
      this.lastSelections.set(editor, editor.selections);
      return null;
    }
    const after = editor.selections;
    if (arrayEqual(before, after)) {
        return null;
    }

    after.forEach((sel, idx) => {
        const beforeSel = before.length > idx ? before[idx] : sel;
        const adjusted = pos.adjustCursorMovement(beforeSel.active, sel.active, this.document, this.prettyModel.getPrettySubstitutionsRanges());

        if (!adjusted.pos.isEqual(sel.active)) {
            updated = true;
        }

        const adjustedAnchor = sel.anchor.isEqual(beforeSel.active) ? adjusted.pos : sel.anchor;
        adjustedSelections.push(new vscode.Selection(adjustedAnchor, adjusted.pos));
    });

    this.lastSelections.set(editor, adjustedSelections);

    if (updated) {
        try {
            editor.selections = adjustedSelections;
        } catch (e) {
            console.error("Failed to set adjusted selections:", e);
            this.lastSelections.set(editor, editor.selections);
            return null;
        }
    }

    return updated ? adjustedSelections : null;
  }

  private revealedRanges: vscode.Range[] = [];
  private cursorRanges: vscode.Range[] = [];
  public selectionChanged(editor: vscode.TextEditor) {
      if (!this.prettyModel || !this.document || editor.document.uri !== this.document.uri) {
          return;
      }

      this.updateSelection.call(() => {
          if (!this.prettyModel || !this.document || !editor || editor.document.uri !== this.document.uri) return;

          let selections: null | vscode.Selection[];
          if (this.adjustCursorMovement) {
              selections = this.adjustCursor(editor);
              if (selections === null) {
                 selections = editor.selections;
              }
          } else {
              selections = editor.selections;
          }

          if (selections == null) {
            selections = editor.selections;
           }

          const currentEditorSelections = editor.selections;
          const cursors = this.prettyModel.renderPrettyCursor(currentEditorSelections);
          const cR = cursors == null ? [] : Array.from(cursors.ranges);
          const revealed = this.prettyModel.revealSelections(currentEditorSelections);

          if (!arrayEqual(revealed.ranges, this.revealedRanges) || !arrayEqual(cR, this.cursorRanges)) {
              this.applyActiveEditorDecorations(
                  [editor],
                  Array.from(this.prettyModel.getDecorationsList()),
                  revealed.ranges,
                  cursors,
              );
              this.revealedRanges = revealed.ranges;
              this.cursorRanges = cR;
          }
      });
  }

}
