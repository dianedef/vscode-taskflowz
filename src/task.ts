import * as vscode from 'vscode';
import { SerializedTask } from './types';
import { v4 as uuidv4 } from 'uuid';

export class Task extends vscode.TreeItem {
    public readonly id: string;
    public parent?: Task;
    public isEditing: boolean = false;

    constructor(
        public label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        public children: Task[] = [],
        public completed: boolean = false,
        public linkedResource?: vscode.Uri,
        id?: string,
        parent?: Task
    ) {
        super(label, collapsibleState);
        this.id = id || uuidv4();
        this.parent = parent;
        this.contextValue = 'task';
        this.tooltip = this.label;

        if (completed) {
            this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('disabledForeground'));
            this.description = '(Terminé)';
            this.tooltip = `${this.label} (Terminé)`;
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
            this.description = '';
        }

        this.children.forEach(child => child.parent = this);
    }

    startEditing() {
        this.isEditing = true;
        this.description = '(Édition en cours...)';
    }

    stopEditing() {
        this.isEditing = false;
        this.description = this.completed ? '(Terminé)' : '';
    }

    // Convertit une tâche en objet sérialisable
    serialize(): SerializedTask {
        return {
            id: this.id,
            label: this.label,
            completed: this.completed,
            children: this.children.map(child => child.serialize()),
            collapsibleState: this.collapsibleState,
            linkedResource: this.linkedResource?.toString(),
            parentId: this.parent?.id
        };
    }

    // Crée une tâche à partir d'un objet sérialisé
    static deserialize(data: SerializedTask, parent?: Task): Task {
        const task = new Task(
            data.label,
            data.collapsibleState,
            [], // Les enfants seront ajoutés après
            data.completed,
            data.linkedResource ? vscode.Uri.parse(data.linkedResource) : undefined,
            data.id,
            parent
        );

        // Ajouter les enfants avec la référence au parent
        task.children = data.children.map(childData => Task.deserialize(childData, task));

        return task;
    }

    // Trouve une tâche par son ID dans l'arbre
    findTaskById(id: string): Task | undefined {
        if (this.id === id) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findTaskById(id);
            if (found) {
                return found;
            }
        }

        return undefined;
    }
} 