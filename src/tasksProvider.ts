import * as vscode from 'vscode';
import { Task } from './task';

export class TasksProvider implements vscode.TreeDataProvider<Task> {
    private _onDidChangeTreeData: vscode.EventEmitter<Task | undefined | null | void> = new vscode.EventEmitter<Task | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [];

    getTreeItem(element: Task): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Task): Thenable<Task[]> {
        if (element) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve(this.tasks);
    }

    addTask(task: Task) {
        this.tasks.push(task);
        this._onDidChangeTreeData.fire();
    }

    toggleTaskComplete(task: Task) {
        task.completed = !task.completed;
        task.description = task.completed ? '(Terminé)' : '';
        this._onDidChangeTreeData.fire();
    }

    addSubTask(parentTask: Task, subTask: Task) {
        parentTask.children.push(subTask);
        if (parentTask.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            parentTask.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        this._onDidChangeTreeData.fire();
    }
} 