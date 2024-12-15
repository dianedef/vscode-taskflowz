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

class AddTaskItem extends vscode.TreeItem {
	constructor() {
		super(t('addTaskLabel'), vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: 'taskflows.addTask',
			title: t('addTask')
		};
		this.iconPath = new vscode.ThemeIcon('add');
	}
}

export function activate(context: vscode.ExtensionContext) {
	const taskFlowsProvider = new TaskFlowsProvider(context);
	vscode.window.registerTreeDataProvider('TaskFlows', taskFlowsProvider);

	// Commande pour ajouter une tâche principale
	let addTaskCommand = vscode.commands.registerCommand('taskflows.addTask', async () => {
		const taskName = await vscode.window.showInputBox({
			placeHolder: t('addTaskPlaceholder'),
			prompt: t('addTaskPrompt')
		});

		if (taskName) {
			taskFlowsProvider.addTask(taskName);
		}
	});

	// Commande pour ajouter une sous-tâche
	let addSubTaskCommand = vscode.commands.registerCommand('taskflows.addSubTask', async (task: Task) => {
		const taskName = await vscode.window.showInputBox({
			placeHolder: t('addTaskPlaceholder'),
			prompt: t('addTaskPrompt')
		});

		if (taskName) {
			taskFlowsProvider.addTask(taskName, task);
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

	// Commande pour plier/déplier toutes les tâches
	let toggleAllCollapsedCommand = vscode.commands.registerCommand('taskflows.toggleAllCollapsed', () => {
		taskFlowsProvider.toggleAllCollapsed();
	});

	context.subscriptions.push(
		addTaskCommand,
		addSubTaskCommand,
		deleteTaskCommand,
		toggleTaskCompletionCommand,
		toggleAllCollapsedCommand
	);
}

export function deactivate() {} 