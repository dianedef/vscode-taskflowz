import * as vscode from 'vscode';
import { Task } from './task';
import { SerializedTask } from './types';

const TASKS_STORAGE_KEY = 'taskflowz.tasks';

export class TaskFlowsProvider implements vscode.TreeDataProvider<Task> {
    private _onDidChangeTreeData: vscode.EventEmitter<Task | undefined | null | void> = new vscode.EventEmitter<Task | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [];
    private storage: vscode.Memento;
    private _treeView?: vscode.TreeView<Task>;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = context.globalState;
        this.loadTasks();
    }

    // Setter pour le TreeView
    setTreeView(treeView: vscode.TreeView<Task>) {
        this._treeView = treeView;
    }

    // Implémentation de getParent requise par TreeDataProvider
    getParent(element: Task): vscode.ProviderResult<Task> {
        return element.parent;
    }

    // Méthode pour mettre à jour l'état de pliage de toutes les tâches
    async setAllTasksCollapsibleState(expand: boolean) {
        // Fonction récursive pour mettre à jour l'état
        const updateTaskState = (task: Task): Task => {
            const newState = task.children.length > 0 
                ? (expand ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
                : vscode.TreeItemCollapsibleState.None;

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
        };

        // Mettre à jour toutes les tâches principales
        this.tasks = this.tasks.map(task => updateTaskState(task));
        this.saveTasks();
        this.refresh();
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
        const sortTasks = (tasks: Task[]): Task[] => {
            return [...tasks].sort((a, b) => {
                if (a.completed === b.completed) {
                    return 0;
                }
                return a.completed ? 1 : -1;
            });
        };

        if (element) {
            return Promise.resolve(sortTasks(element.children));
        }
        return Promise.resolve(sortTasks(this.tasks));
    }

    addTask(taskName: string, parentTask?: Task) {
        const newTask = new Task(taskName);
        
        if (parentTask) {
            // Ajouter comme sous-tâche
            parentTask.children.push(newTask);
            newTask.parent = parentTask;

            // Toujours mettre le parent en état expanded
            const updatedParent = new Task(
                parentTask.label,
                vscode.TreeItemCollapsibleState.Expanded,
                parentTask.children,
                parentTask.completed,
                parentTask.linkedResource,
                parentTask.id,
                parentTask.parent
            );

            // Fonction récursive pour trouver et mettre à jour une tâche dans l'arbre
            const updateTaskInTree = (tasks: Task[], taskToUpdate: Task): boolean => {
                for (let i = 0; i < tasks.length; i++) {
                    if (tasks[i].id === taskToUpdate.id) {
                        tasks[i] = taskToUpdate;
                        return true;
                    }
                    if (tasks[i].children.length > 0) {
                        if (updateTaskInTree(tasks[i].children, taskToUpdate)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            // Mettre à jour le parent dans l'arbre complet
            if (!updateTaskInTree(this.tasks, updatedParent)) {
                // Si le parent n'est pas trouvé dans l'arbre, c'est une tâche principale
                const index = this.tasks.indexOf(parentTask);
                if (index !== -1) {
                    this.tasks[index] = updatedParent;
                }
            }

            // Mettre à jour les références parent
            updatedParent.children.forEach(child => child.parent = updatedParent);

            // Révéler la nouvelle tâche
            this._treeView?.reveal(newTask, {
                select: true,
                focus: true,
                expand: true
            });
        } else {
            // Ajouter comme tâche principale
            this.tasks.push(newTask);
        }
        
        this.saveTasks();
        this.refresh();
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

    // Obtenir toutes les tâches visibles
    getVisibleTasks(): Task[] {
        return this.tasks;
    }
} 