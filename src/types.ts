import * as vscode from 'vscode';

export interface SerializedTask {
    id: string;
    label: string;
    completed: boolean;
    children: SerializedTask[];
    collapsibleState: vscode.TreeItemCollapsibleState;
    linkedResource?: string;
    parentId?: string;
} 