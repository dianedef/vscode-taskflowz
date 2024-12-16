import * as vscode from 'vscode';
import { TaskData } from './types';

export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        private readonly taskData: TaskData
    ) {
        super(
            taskData.label,
            taskData.children.length > 0 
                ? vscode.TreeItemCollapsibleState.Expanded 
                : vscode.TreeItemCollapsibleState.None
        );

        this.tooltip = taskData.label;
        this.contextValue = 'task';

        if (taskData.completed) {
            this.iconPath = new vscode.ThemeIcon('check');
            this.description = '(Terminé)';
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }

    get data(): TaskData {
        return this.taskData;
    }
} 