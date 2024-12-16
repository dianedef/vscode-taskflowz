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

	// Helper pour obtenir l'élément sélectionné
	const getSelectedTask = () => {
		return treeView.selection[0];
	};

	// Commande pour éditer une tâche
	let editTaskCommand = vscode.commands.registerCommand('taskflows.editTask', async (item) => {
		const taskItem = item || getSelectedTask();
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
			taskFlowsProvider.updateTaskLabel(taskItem.data.id, newLabel);
		}
	});

	// Commande pour ajouter une tâche principale
	let addTaskCommand = vscode.commands.registerCommand('taskflows.addTask', async () => {
		const newName = await createCenteredModal(
			t('newTaskTitle'),
			t('addTaskPlaceholder'),
			''
		);
		if (newName) {
			taskFlowsProvider.addTask(newName);
		}
	});

	// Commande pour ajouter une sous-tâche
	let addSubTaskCommand = vscode.commands.registerCommand('taskflows.addSubTask', async (item) => {
		const taskItem = item || getSelectedTask();
		if (!taskItem) {
			vscode.window.showWarningMessage('Veuillez sélectionner une tâche parent');
			return;
		}

		const newName = await createCenteredModal(
			t('newSubTaskTitle'),
			t('addTaskPlaceholder'),
			''
		);
		if (newName) {
			const newTask = taskFlowsProvider.addTask(newName, taskItem.data);
			// Révéler la nouvelle tâche et son chemin
			await taskFlowsProvider.revealTask(newTask.id, treeView);
		}
	});

	// Commande pour supprimer une tâche
	let deleteTaskCommand = vscode.commands.registerCommand('taskflows.deleteTask', (item) => {
		const taskItem = item || getSelectedTask();
		if (!taskItem) {
			vscode.window.showWarningMessage('Veuillez sélectionner une tâche à supprimer');
			return;
		}
		taskFlowsProvider.deleteTask(taskItem.data.id);
	});

	// Commande pour basculer l'état de complétion d'une tâche
	let toggleTaskCompletionCommand = vscode.commands.registerCommand('taskflows.toggleTaskCompletion', (item) => {
		const taskItem = item || getSelectedTask();
		if (!taskItem) {
			vscode.window.showWarningMessage('Veuillez sélectionner une tâche');
			return;
		}
		taskFlowsProvider.toggleTaskCompletion(taskItem.data.id);
	});

	// Commande pour annuler la dernière action
	let undoCommand = vscode.commands.registerCommand('taskflows.undo', () => {
		taskFlowsProvider.undo();
	});

	// Commande pour rétablir la dernière action annulée
	let redoCommand = vscode.commands.registerCommand('taskflows.redo', () => {
		taskFlowsProvider.redo();
	});

	// Commande pour activer la vue TaskFlows
	let focusCommand = vscode.commands.registerCommand('taskflows.focus', async () => {
		// Ouvrir l'explorateur
		await vscode.commands.executeCommand('workbench.view.explorer');
		// Forcer le focus sur le panneau latéral
		await vscode.commands.executeCommand('workbench.action.focusSideBar');
		
		// Si nous avons une sélection, la révéler
		if (treeView.selection.length > 0) {
			await taskFlowsProvider.revealTask(treeView.selection[0].data.id, treeView);
		} else {
			const firstTask = taskFlowsProvider.getFirstTask();
			if (firstTask) {
				await taskFlowsProvider.revealTask(firstTask.data.id, treeView);
			}
		}
	});

	context.subscriptions.push(
		treeView,
		focusCommand,
		addTaskCommand,
		addSubTaskCommand,
		deleteTaskCommand,
		toggleTaskCompletionCommand,
		editTaskCommand,
		undoCommand,
		redoCommand
	);
}

export function deactivate() {} 