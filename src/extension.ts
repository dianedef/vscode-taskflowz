import * as vscode from 'vscode';
import { Task } from './task';
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

export function activate(context: vscode.ExtensionContext) {
	const taskFlowsProvider = new TaskFlowsProvider(context);
	
	// Créer la TreeView avec le provider
	const treeView = vscode.window.createTreeView('TaskFlows', {
		treeDataProvider: taskFlowsProvider,
		showCollapseAll: true,
		canSelectMany: false
	});

	// Configurer la TreeView dans le provider
	taskFlowsProvider.setTreeView(treeView);

	// Commande pour éditer une tâche
	let editTaskCommand = vscode.commands.registerCommand('taskflows.editTask', (task: Task) => {
		taskFlowsProvider.startTaskEditing(task);
	});

	// Commande pour ajouter une tâche principale
	let addTaskCommand = vscode.commands.registerCommand('taskflows.addTask', async () => {
		const newName = await createCenteredModal(
			'Nouvelle tâche',
			t('addTaskPlaceholder'),
			''
		);
		if (newName) {
			taskFlowsProvider.addTask(newName);
		}
	});

	// Commande pour ajouter une sous-tâche
	let addSubTaskCommand = vscode.commands.registerCommand('taskflows.addSubTask', async (task: Task) => {
		const newName = await createCenteredModal(
			'Nouvelle sous-tâche',
			t('addTaskPlaceholder'),
			''
		);
		if (newName) {
			taskFlowsProvider.addTask(newName, task);
		}
	});

	// Commande pour supprimer une tâche
	let deleteTaskCommand = vscode.commands.registerCommand('taskflows.deleteTask', (task: Task) => {
		taskFlowsProvider.deleteTask(task);
	});

	// Commande pour basculer l'état de complétion d'une tâche
	let toggleTaskCompletionCommand = vscode.commands.registerCommand('taskflows.toggleTaskCompletion', (task: Task) => {
		taskFlowsProvider.toggleTaskCompletion(task);
	});

	context.subscriptions.push(
		treeView,
		addTaskCommand,
		addSubTaskCommand,
		deleteTaskCommand,
		toggleTaskCompletionCommand,
		editTaskCommand
	);
}

export function deactivate() {} 