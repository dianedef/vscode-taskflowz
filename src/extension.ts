import * as vscode from 'vscode';

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
		super("Ajouter une tâche...", vscode.TreeItemCollapsibleState.None);
		this.command = {
			command: 'taskflows.addTask',
			title: 'Ajouter une tâche'
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
	console.log('TaskFlowz est maintenant actif !');

	const taskFlowsProvider = new TaskFlowsProvider();
	vscode.window.registerTreeDataProvider('TaskFlows', taskFlowsProvider);

	let addTaskCommand = vscode.commands.registerCommand('taskflows.addTask', async () => {
		const taskName = await vscode.window.showInputBox({
			placeHolder: 'Nom de la tâche',
			prompt: 'Entrez le nom de la nouvelle tâche'
		});

		if (taskName) {
			taskFlowsProvider.addTask(taskName);
		}
	});

	context.subscriptions.push(addTaskCommand);
}

export function deactivate() {} 