import * as vscode from 'vscode';

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

class Task extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		super(label, collapsibleState);
	}
}

class AddTaskItem extends Task {
	constructor() {
		super(t('addTaskLabel'), vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: 'taskflows.addTask',
			title: t('addTask')
		};
		this.iconPath = new vscode.ThemeIcon('add');
	}
}

class TaskFlowsProvider implements vscode.TreeDataProvider<Task> {
	private _onDidChangeTreeData: vscode.EventEmitter<Task | undefined | null | void> = new vscode.EventEmitter<Task | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

	private tasks: Task[] = [];

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Task): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Task): Thenable<Task[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			return Promise.resolve([...this.tasks, new AddTaskItem()]);
		}
	}

	addTask(taskName: string) {
		const task = new Task(taskName);
		this.tasks.push(task);
		this.refresh();
	}
}

export function activate(context: vscode.ExtensionContext) {
	const taskFlowsProvider = new TaskFlowsProvider();
	vscode.window.registerTreeDataProvider('TaskFlows', taskFlowsProvider);

	let addTaskCommand = vscode.commands.registerCommand('taskflows.addTask', async () => {
		const taskName = await vscode.window.showInputBox({
			placeHolder: t('addTaskPlaceholder'),
			prompt: t('addTaskPrompt')
		});

		if (taskName) {
			taskFlowsProvider.addTask(taskName);
		}
	});

	context.subscriptions.push(addTaskCommand);
}

export function deactivate() {} 