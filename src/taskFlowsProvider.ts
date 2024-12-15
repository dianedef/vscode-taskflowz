import * as vscode from 'vscode';
import { Task } from './task';
import { SerializedTask } from './types';

const TASKS_STORAGE_KEY = 'taskflowz.tasks';

export class TaskFlowsProvider implements vscode.TreeDataProvider<Task> {
    private _onDidChangeTreeData: vscode.EventEmitter<Task | undefined | null | void> = new vscode.EventEmitter<Task | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [];
    private storage: vscode.Memento;
    private allCollapsed: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = context.globalState;
        this.loadTasks();
    }

    private loadTasks() {
        const savedTasks = this.storage.get<SerializedTask[]>(TASKS_STORAGE_KEY, []);
        this.tasks = savedTasks.map(task => Task.deserialize(task));
    }

    private saveTasks() {
        const serializedTasks = this.tasks.map(task => task.serialize());
        this.storage.update(TASKS_STORAGE_KEY, serializedTasks);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Task): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Task): Thenable<Task[]> {
        if (element) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve(this.tasks);
    }

    // Trouve une tâche par son ID dans toutes les tâches
    findTaskById(id: string): Task | undefined {
        for (const task of this.tasks) {
            const found = task.findTaskById(id);
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    addTask(taskName: string, parentTask?: Task) {
        const newTask = new Task(taskName);
        
        if (parentTask) {
            // Fonction pour trouver la tâche racine
            const findRootTask = (task: Task): Task => {
                return task.parent ? findRootTask(task.parent) : task;
            };

            // Fonction pour mettre à jour une tâche et ses enfants
            const updateTaskAndChildren = (task: Task, targetId: string): Task => {
                if (task.id === targetId) {
                    // C'est la tâche à mettre à jour
                    const updatedChildren = [...task.children, newTask];
                    const updatedTask = new Task(
                        task.label,
                        vscode.TreeItemCollapsibleState.Expanded,
                        updatedChildren,
                        task.completed,
                        task.linkedResource,
                        task.id,
                        task.parent
                    );
                    // Mettre à jour les références parent
                    updatedChildren.forEach(child => child.parent = updatedTask);
                    return updatedTask;
                }

                if (task.children.some(child => child.id === targetId || child.findTaskById(targetId))) {
                    // La tâche cible est dans les enfants, mettre à jour récursivement
                    const updatedChildren = task.children.map(child => updateTaskAndChildren(child, targetId));
                    const updatedTask = new Task(
                        task.label,
                        task.collapsibleState,
                        updatedChildren,
                        task.completed,
                        task.linkedResource,
                        task.id,
                        task.parent
                    );
                    // Mettre à jour les références parent
                    updatedChildren.forEach(child => child.parent = updatedTask);
                    return updatedTask;
                }

                return task;
            };

            // Trouver la racine et mettre à jour l'arbre
            const rootTask = findRootTask(parentTask);
            const rootIndex = this.tasks.indexOf(rootTask);
            
            if (rootIndex !== -1) {
                // Mettre à jour l'arbre à partir de la racine
                this.tasks[rootIndex] = updateTaskAndChildren(rootTask, parentTask.id);
            }
        } else {
            // Ajouter comme tâche principale
            this.tasks.push(newTask);
        }
        
        this.saveTasks();
        this.refresh();

        // Forcer un rafraîchissement supplémentaire après un court délai
        setTimeout(() => {
            this.refresh();
        }, 100);

        return newTask;
    }

    deleteTask(task: Task) {
        // Chercher dans les tâches principales
        const index = this.tasks.indexOf(task);
        if (index > -1) {
            this.tasks.splice(index, 1);
            this.saveTasks();
            this.refresh();
            return;
        }

        // Chercher dans les sous-tâches
        if (task.parent) {
            const childIndex = task.parent.children.indexOf(task);
            if (childIndex > -1) {
                task.parent.children.splice(childIndex, 1);
                if (task.parent.children.length === 0) {
                    const updatedParent = new Task(
                        task.parent.label,
                        vscode.TreeItemCollapsibleState.None,
                        [],
                        task.parent.completed,
                        task.parent.linkedResource,
                        task.parent.id,
                        task.parent.parent
                    );
                    const parentIndex = this.tasks.indexOf(task.parent);
                    if (parentIndex !== -1) {
                        this.tasks[parentIndex] = updatedParent;
                    }
                }
                this.saveTasks();
                this.refresh();
                return;
            }
        }
    }

    toggleTaskCompletion(task: Task) {
        // Chercher dans les tâches principales
        const index = this.tasks.indexOf(task);
        if (index > -1) {
            const updatedTask = new Task(
                task.label,
                task.collapsibleState,
                task.children,
                !task.completed,
                task.linkedResource,
                task.id,
                task.parent
            );
            updatedTask.children.forEach(child => child.parent = updatedTask);
            this.tasks[index] = updatedTask;
            this.saveTasks();
            this.refresh();
            return;
        }

        // Chercher dans les sous-tâches
        if (task.parent) {
            const childIndex = task.parent.children.indexOf(task);
            if (childIndex > -1) {
                const updatedTask = new Task(
                    task.label,
                    task.collapsibleState,
                    task.children,
                    !task.completed,
                    task.linkedResource,
                    task.id,
                    task.parent
                );
                updatedTask.children.forEach(child => child.parent = updatedTask);
                task.parent.children[childIndex] = updatedTask;
                this.saveTasks();
                this.refresh();
                return;
            }
        }
    }

    toggleAllCollapsed() {
        this.allCollapsed = !this.allCollapsed;
        const newState = this.allCollapsed ? 
            vscode.TreeItemCollapsibleState.Collapsed : 
            vscode.TreeItemCollapsibleState.Expanded;

        // Fonction récursive pour mettre à jour l'état de toutes les tâches
        const updateTaskState = (task: Task): Task => {
            if (task.children.length > 0) {
                const updatedChildren = task.children.map(child => updateTaskState(child));
                return new Task(
                    task.label,
                    newState,
                    updatedChildren,
                    task.completed,
                    task.linkedResource,
                    task.id,
                    task.parent
                );
            }
            return task;
        };

        // Mettre à jour toutes les tâches principales
        this.tasks = this.tasks.map(task => updateTaskState(task));
        
        this.saveTasks();
        this.refresh();
    }
} 