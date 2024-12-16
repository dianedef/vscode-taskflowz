import * as vscode from 'vscode';
import { Task } from './task';
import { SerializedTask } from './types';

const TASKS_STORAGE_KEY = 'taskflowz.tasks';

export class TaskFlowsProvider implements vscode.TreeDataProvider<Task>, vscode.TreeDragAndDropController<Task> {
    private _onDidChangeTreeData: vscode.EventEmitter<Task | undefined | null | void> = new vscode.EventEmitter<Task | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

    // Propriétés pour le drag & drop
    public readonly dropMimeTypes = ['application/vnd.code.tree.taskflows'];
    public readonly dragMimeTypes = ['application/vnd.code.tree.taskflows'];

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

    // Support du drag & drop
    public readonly onDidChangeTreeData2: vscode.Event<Task | undefined | null | void> = this._onDidChangeTreeData.event;

    // Méthodes pour le drag & drop
    async handleDrag(items: readonly Task[], dataTransfer: vscode.DataTransfer): Promise<void> {
        const item = items[0]; // On prend le premier élément même si plusieurs sont sélectionnés
        dataTransfer.set('application/vnd.code.tree.taskflows', new vscode.DataTransferItem(item));
    }

    async handleDrop(target: Task | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const droppedItem = dataTransfer.get('application/vnd.code.tree.taskflows');
        if (!droppedItem) {
            return;
        }

        const source = droppedItem.value as Task;

        // Vérifier que la source n'est pas déposée sur elle-même ou sur un de ses enfants
        const isSourceOrChild = (task: Task): boolean => {
            if (task === source) return true;
            return task.children.some(child => isSourceOrChild(child));
        };

        if (target && isSourceOrChild(target)) {
            return; // Empêcher le dépôt sur soi-même ou sur ses enfants
        }

        // Si on dépose sur rien, on met à la racine
        if (!target) {
            if (source.parent) {
                // Retirer de l'ancien parent
                const sourceIndex = source.parent.children.indexOf(source);
                if (sourceIndex > -1) {
                    source.parent.children.splice(sourceIndex, 1);
                }
                source.parent = undefined;
            } else {
                // Si déjà à la racine, on retire de la racine
                const sourceIndex = this.tasks.indexOf(source);
                if (sourceIndex > -1) {
                    this.tasks.splice(sourceIndex, 1);
                }
            }
            // Ajouter à la racine
            this.tasks.push(source);
        } else {
            // Si on dépose sur une tâche
            if (source.parent) {
                // Retirer de l'ancien parent
                const sourceIndex = source.parent.children.indexOf(source);
                if (sourceIndex > -1) {
                    source.parent.children.splice(sourceIndex, 1);
                }
            } else {
                // Retirer de la racine
                const sourceIndex = this.tasks.indexOf(source);
                if (sourceIndex > -1) {
                    this.tasks.splice(sourceIndex, 1);
                }
            }

            // Ajouter au nouveau parent
            target.children.push(source);
            source.parent = target;

            // Mettre à jour l'état du parent si nécessaire
            if (target.collapsibleState === vscode.TreeItemCollapsibleState.None) {
                const updatedTarget = new Task(
                    target.label,
                    vscode.TreeItemCollapsibleState.Expanded,
                    target.children,
                    target.completed,
                    target.linkedResource,
                    target.id,
                    target.parent
                );
                this.updateTask(target, updatedTarget);
            }
        }

        this.saveTasks();
        this.refresh();
    }

    getDragUri(task: Task): vscode.Uri {
        return vscode.Uri.parse(`taskflows:${task.id}`);
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
            parentTask.children.push(newTask);
            newTask.parent = parentTask;

            const updatedParent = new Task(
                parentTask.label,
                vscode.TreeItemCollapsibleState.Expanded,
                parentTask.children,
                parentTask.completed,
                parentTask.linkedResource,
                parentTask.id,
                parentTask.parent
            );

            if (!this.updateTaskInTree(this.tasks, updatedParent)) {
                const index = this.tasks.indexOf(parentTask);
                if (index !== -1) {
                    this.tasks[index] = updatedParent;
                }
            }

            updatedParent.children.forEach(child => child.parent = updatedParent);

            this._treeView?.reveal(newTask, {
                select: true,
                focus: true,
                expand: true
            });
        } else {
            this.tasks.push(newTask);
        }
        
        this.saveTasks();
        this.refresh();
        
        // Commencer l'édition immédiatement
        this.startTaskEditing(newTask);
        
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

    // Mettre à jour une tâche existante
    updateTask(oldTask: Task, updatedTask: Task) {
        // Chercher dans les tâches principales
        const index = this.tasks.indexOf(oldTask);
        if (index > -1) {
            this.tasks[index] = updatedTask;
            updatedTask.children.forEach(child => child.parent = updatedTask);
            this.saveTasks();
            this.refresh();
            return;
        }

        // Chercher dans les sous-tâches
        if (oldTask.parent) {
            const childIndex = oldTask.parent.children.indexOf(oldTask);
            if (childIndex > -1) {
                oldTask.parent.children[childIndex] = updatedTask;
                updatedTask.children.forEach(child => child.parent = updatedTask);
                this.saveTasks();
                this.refresh();
                return;
            }
        }
    }

    // Commencer l'édition d'une tâche
    async startTaskEditing(task: Task) {
        const newLabel = await vscode.commands.executeCommand<string>('taskflows.showCenteredInput', {
            value: task.label,
            title: 'Modifier la tâche',
            placeholder: 'Entrez le nouveau nom de la tâche'
        });

        if (newLabel && newLabel !== task.label) {
            const updatedTask = new Task(
                newLabel,
                task.collapsibleState,
                task.children,
                task.completed,
                task.linkedResource,
                task.id,
                task.parent
            );
            this.updateTask(task, updatedTask);
        }
    }

    // Mettre à jour une tâche dans l'arbre
    private updateTaskInTree(tasks: Task[], taskToUpdate: Task): boolean {
        for (let i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskToUpdate.id) {
                tasks[i] = taskToUpdate;
                return true;
            }
            if (tasks[i].children.length > 0) {
                if (this.updateTaskInTree(tasks[i].children, taskToUpdate)) {
                    return true;
                }
            }
        }
        return false;
    }

    // Obtenir toutes les tâches visibles
    getVisibleTasks(): Task[] {
        return this.tasks;
    }
} 