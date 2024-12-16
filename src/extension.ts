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

export function activate(context: vscode.ExtensionContext) {
	const taskFlowsProvider = new TaskFlowsProvider(context);
	
	// Créer la TreeView avec le provider
	const treeView = vscode.window.createTreeView('TaskFlows', {
		treeDataProvider: taskFlowsProvider,
		showCollapseAll: true,
		canSelectMany: false,
		dragAndDropController: taskFlowsProvider
	});

	// Commande pour éditer une tâche
	let editTaskCommand = vscode.commands.registerCommand('taskflows.editTask', async (item) => {
		const newLabel = await createCenteredModal(
			'Modifier la tâche',
			'Entrez le nouveau nom de la tâche',
			item.data.label
		);
		if (newLabel && newLabel !== item.data.label) {
			taskFlowsProvider.updateTaskLabel(item.data.id, newLabel);
		}
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
	let addSubTaskCommand = vscode.commands.registerCommand('taskflows.addSubTask', async (item) => {
		const newName = await createCenteredModal(
			'Nouvelle sous-tâche',
			t('addTaskPlaceholder'),
			''
		);
		if (newName) {
			taskFlowsProvider.addTask(newName, item.data);
		}
	});

	// Commande pour supprimer une tâche
	let deleteTaskCommand = vscode.commands.registerCommand('taskflows.deleteTask', (item) => {
		taskFlowsProvider.deleteTask(item.data.id);
	});

	// Commande pour basculer l'état de complétion d'une tâche
	let toggleTaskCompletionCommand = vscode.commands.registerCommand('taskflows.toggleTaskCompletion', (item) => {
		taskFlowsProvider.toggleTaskCompletion(item.data.id);
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