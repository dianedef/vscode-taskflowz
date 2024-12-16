import * as vscode from 'vscode';

export interface TaskData {
    id: string;
    label: string;
    completed: boolean;
    children: TaskData[];
} 