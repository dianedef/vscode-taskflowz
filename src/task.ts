import * as vscode from 'vscode';
import * as path from 'path';

export class Task extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        public children: Task[] = [],
        public completed: boolean = false,
        public linkedResource?: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
        this.description = completed ? '(Terminé)' : '';
        this.contextValue = 'task';
        
        // Icône pour la tâche
        this.iconPath = {
            light: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'light', completed ? 'check.svg' : 'task.svg')),
            dark: vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'dark', completed ? 'check.svg' : 'task.svg'))
        };
    }
} 