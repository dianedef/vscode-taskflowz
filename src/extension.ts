import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('TaskFlowz est maintenant actif !');

	// Création de la vue TaskFlows
	const taskFlowsProvider = new TaskFlowsProvider();
	vscode.window.registerTreeDataProvider('TaskFlows', taskFlowsProvider);
}

class TaskFlowsProvider implements vscode.TreeDataProvider<any> {
	getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	getChildren(element?: any): vscode.ProviderResult<any[]> {
		return [];
	}
}

export function deactivate() {} 