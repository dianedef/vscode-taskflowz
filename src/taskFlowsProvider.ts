import * as vscode from 'vscode';
import { TaskData } from './types';
import { TaskTreeItem } from './taskTreeItem';
import { v4 as uuidv4 } from 'uuid';

const TASKS_STORAGE_KEY = 'taskflowz.tasks';

export class TaskFlowsProvider implements vscode.TreeDataProvider<TaskTreeItem>, vscode.TreeDragAndDropController<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    readonly dropMimeTypes: string[] = ['application/vnd.code.tree.taskflows'];
    readonly dragMimeTypes: string[] = ['application/vnd.code.tree.taskflows'];

    private tasks: TaskData[] = [];
    private storage: vscode.Memento;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = context.globalState;
        this.loadTasks();
    }

    // Méthodes de TreeDataProvider
    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
        const tasks = element ? element.data.children : this.tasks;
        return Promise.resolve(
            tasks
                .sort((a, b) => a.completed === b.completed ? 0 : (a.completed ? 1 : -1))
                .map(task => new TaskTreeItem(task))
        );
    }

    getParent(element: TaskTreeItem): vscode.ProviderResult<TaskTreeItem> {
        return null; // Pas besoin de parent pour l'affichage
    }

    // Méthodes de drag & drop
    async handleDrag(items: readonly TaskTreeItem[], dataTransfer: vscode.DataTransfer): Promise<void> {
        dataTransfer.set('application/vnd.code.tree.taskflows', new vscode.DataTransferItem(items[0].data));
    }

    async handleDrop(target: TaskTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const droppedItem = dataTransfer.get('application/vnd.code.tree.taskflows');
        if (!droppedItem) return;

        const sourceData = droppedItem.value as TaskData;
        
        // Fonction récursive pour trouver et supprimer une tâche
        const removeTask = (tasks: TaskData[], taskId: string): boolean => {
            const index = tasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                tasks.splice(index, 1);
                return true;
            }
            return tasks.some(t => removeTask(t.children, taskId));
        };

        // Supprimer la tâche de son emplacement actuel
        removeTask(this.tasks, sourceData.id);

        // Ajouter la tâche à sa nouvelle position
        if (!target) {
            this.tasks.push(sourceData);
        } else {
            target.data.children.push(sourceData);
        }

        this.saveTasks();
        this.refresh();
    }

    // Méthodes de gestion des tâches
    addTask(label: string, parentTask?: TaskData) {
        const newTask: TaskData = {
            id: uuidv4(),
            label,
            completed: false,
            children: []
        };

        if (parentTask) {
            parentTask.children.push(newTask);
        } else {
            this.tasks.push(newTask);
        }

        this.saveTasks();
        this.refresh();
        return newTask;
    }

    deleteTask(taskId: string) {
        const removeTask = (tasks: TaskData[], id: string): boolean => {
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                tasks.splice(index, 1);
                return true;
            }
            return tasks.some(t => removeTask(t.children, id));
        };

        removeTask(this.tasks, taskId);
        this.saveTasks();
        this.refresh();
    }

    toggleTaskCompletion(taskId: string) {
        const toggleTask = (tasks: TaskData[], id: string): boolean => {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                return true;
            }
            return tasks.some(t => toggleTask(t.children, id));
        };

        toggleTask(this.tasks, taskId);
        this.saveTasks();
        this.refresh();
    }

    updateTaskLabel(taskId: string, newLabel: string) {
        const updateTask = (tasks: TaskData[], id: string): boolean => {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.label = newLabel;
                return true;
            }
            return tasks.some(t => updateTask(t.children, id));
        };

        updateTask(this.tasks, taskId);
        this.saveTasks();
        this.refresh();
    }

    private loadTasks() {
        this.tasks = this.storage.get<TaskData[]>(TASKS_STORAGE_KEY, []);
    }

    private saveTasks() {
        this.storage.update(TASKS_STORAGE_KEY, this.tasks);
    }

    private refresh(): void {
        this._onDidChangeTreeData.fire();
    }
} 