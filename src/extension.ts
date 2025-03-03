import * as vscode from 'vscode';
import { TaskFlowsProvider } from './taskFlowsProvider';

// Chargement du bundle de traduction
const messages = {
	en: require('../package.nls.json'),
	fr: require('../package.nls.fr.json')
};

// Fonction helper pour obtenir la traduction
function t(key: string): string {
	const language = vscode.env.language;
	const bundle = messages[language as keyof typeof messages] || messages.en;
	return bundle[key as keyof typeof messages.en] || messages.en[key as keyof typeof messages.en];
}

// Fonction pour créer une modale centrée
function createCenteredModal(title: string, placeholder: string, initialValue: string = ''): Promise<string | undefined> {
	return new Promise((resolve) => {
		const quickPick = vscode.window.createQuickPick();
		quickPick.title = title;
		quickPick.placeholder = placeholder;
		quickPick.value = initialValue;
		quickPick.buttons = [vscode.QuickInputButtons.Back];
		quickPick.ignoreFocusOut = true;

		quickPick.onDidAccept(() => {
			const value = quickPick.value.trim();
			quickPick.hide();
			resolve(value || undefined);
		});

		quickPick.onDidHide(() => {
			quickPick.dispose();
			resolve(undefined);
		});

		quickPick.show();
	});
}

// Classe pour gérer la WebView
class TaskFlowzWebView {
	public static currentPanel: TaskFlowzWebView | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel) {
		this._panel = panel;
		this._panel.webview.html = this._getWebviewContent();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public static createOrShow() {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (TaskFlowzWebView.currentPanel) {
			TaskFlowzWebView.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'taskFlowzWebView',
			'TaskFlowz Web',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [],
				enableCommandUris: true
			}
		);

		TaskFlowzWebView.currentPanel = new TaskFlowzWebView(panel);
	}

	private _getWebviewContent() {
		return `<!DOCTYPE html>
			<html lang="fr">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>TaskFlowz Web</title>
				<style>
					body { 
						margin: 0; 
						padding: 20px;
						background-color: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
						font-family: var(--vscode-font-family);
					}
					iframe {
						width: 100%;
						height: 600px;
						border: 1px solid var(--vscode-panel-border);
						border-radius: 4px;
					}
				</style>
			</head>
			<body>
				<h1>TaskFlowz Web View</h1>
				<p>Voici votre page web intégrée :</p>
				<iframe src="https://example.com" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
			</body>
			</html>`;
	}

	public dispose() {
		TaskFlowzWebView.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('TaskFlowz: Début de l\'activation...');
	
	try {
		console.log('TaskFlowz: Création du provider...');
		const taskFlowsProvider = new TaskFlowsProvider(context);
		console.log('TaskFlowz: Provider créé avec succès');

		console.log('TaskFlowz: Création de la TreeView...');
		const treeView = vscode.window.createTreeView('taskFlowzView', {
			treeDataProvider: taskFlowsProvider,
			showCollapseAll: true,
			canSelectMany: false,
			dragAndDropController: taskFlowsProvider
		});
		console.log('TaskFlowz: TreeView créée avec succès');

		// Helper pour obtenir l'élément sélectionné
		const getSelectedTask = () => {
			console.log('TaskFlowz: Récupération de la tâche sélectionnée...');
			const selected = treeView.selection[0];
			console.log('TaskFlowz: Tâche sélectionnée:', selected ? selected.data.label : 'aucune');
			return selected;
		};

		console.log('TaskFlowz: Enregistrement des commandes...');

		// Commande pour éditer une tâche
		let editTaskCommand = vscode.commands.registerCommand('taskFlowz.editTask', async (item) => {
			console.log('TaskFlowz: Exécution de editTask...');
			const taskItem = item || getSelectedTask();
			console.log('TaskFlowz: Tâche à éditer:', taskItem ? taskItem.data.label : 'aucune');
			if (!taskItem) {
				vscode.window.showWarningMessage('Veuillez sélectionner une tâche à éditer');
				return;
			}

			const newLabel = await createCenteredModal(
				t('editTaskTitle'),
				t('editTaskInputPrompt'),
				taskItem.data.label
			);
			if (newLabel && newLabel !== taskItem.data.label) {
				console.log('TaskFlowz: Mise à jour du label:', newLabel);
				taskFlowsProvider.updateTaskLabel(taskItem.data.id, newLabel);
			}
		});

		// Commande pour ajouter une tâche principale
		let addTaskCommand = vscode.commands.registerCommand('taskFlowz.addTask', async () => {
			console.log('TaskFlowz: Exécution de addTask...');
			const newName = await createCenteredModal(
				t('newTaskTitle'),
				t('addTaskPlaceholder'),
				''
			);
			if (newName) {
				console.log('TaskFlowz: Ajout d\'une nouvelle tâche:', newName);
				taskFlowsProvider.addTask(newName);
			}
		});

		// Commande pour supprimer une tâche
		let deleteTaskCommand = vscode.commands.registerCommand('taskFlowz.deleteTask', (item) => {
			console.log('TaskFlowz: Exécution de deleteTask...');
			const taskItem = item || getSelectedTask();
			console.log('TaskFlowz: Tâche à supprimer:', taskItem ? taskItem.data.label : 'aucune');
			if (!taskItem) {
				vscode.window.showWarningMessage('Veuillez sélectionner une tâche à supprimer');
				return;
			}
			taskFlowsProvider.deleteTask(taskItem.data.id);
		});

		// Commande pour basculer l'état de complétion d'une tâche
		let toggleTaskCommand = vscode.commands.registerCommand('taskFlowz.toggleTask', (item) => {
			console.log('TaskFlowz: Exécution de toggleTask...');
			const taskItem = item || getSelectedTask();
			console.log('TaskFlowz: Tâche à basculer:', taskItem ? taskItem.data.label : 'aucune');
			if (!taskItem) {
				vscode.window.showWarningMessage('Veuillez sélectionner une tâche');
				return;
			}
			taskFlowsProvider.toggleTaskCompletion(taskItem.data.id);
		});

		// Commande pour annuler la dernière action
		let undoCommand = vscode.commands.registerCommand('taskFlowz.undo', () => {
			console.log('TaskFlowz: Exécution de undo...');
			taskFlowsProvider.undo();
		});

		// Commande pour réduire toutes les tâches
		let collapseAllCommand = vscode.commands.registerCommand('taskFlowz.collapseAll', () => {
			console.log('TaskFlowz: Exécution de collapseAll...');
			vscode.commands.executeCommand('workbench.actions.treeView.taskFlowzView.collapseAll');
		});

		// Commande pour activer la vue TaskFlows
		let focusTaskListCommand = vscode.commands.registerCommand('taskFlowz.focusTaskList', async () => {
			console.log('TaskFlowz: Exécution de focusTaskList...');
			
			console.log('TaskFlowz: Focus sur le panneau TaskFlowz...');
			await vscode.commands.executeCommand('workbench.view.extension.taskFlowz');
			
			console.log('TaskFlowz: Vérification de la sélection...');
			if (treeView.selection.length > 0) {
				console.log('TaskFlowz: Révélation de la tâche sélectionnée...');
				await taskFlowsProvider.revealTask(treeView.selection[0].data.id, treeView);
			} else {
				console.log('TaskFlowz: Recherche de la première tâche...');
				const firstTask = taskFlowsProvider.getFirstTask();
				if (firstTask) {
					console.log('TaskFlowz: Révélation de la première tâche...');
					await taskFlowsProvider.revealTask(firstTask.data.id, treeView);
				}
			}
		});

		// Nouvelle commande pour ouvrir la WebView
		let openWebViewCommand = vscode.commands.registerCommand('taskFlowz.openWebView', () => {
			console.log('TaskFlowz: Ouverture de la WebView...');
			TaskFlowzWebView.createOrShow();
		});

		console.log('TaskFlowz: Ajout des commandes au contexte...');
		context.subscriptions.push(
			treeView,
			focusTaskListCommand,
			addTaskCommand,
			deleteTaskCommand,
			toggleTaskCommand,
			editTaskCommand,
			undoCommand,
			collapseAllCommand,
			openWebViewCommand
		);

		console.log('TaskFlowz: Activation terminée avec succès');
	} catch (error) {
		console.error('TaskFlowz: Erreur lors de l\'activation:', error);
		throw error;
	}
}

export function deactivate() {} 