import * as vscode from 'vscode';
import { TaskData } from './types';
import { TaskTreeItem } from './taskTreeItem';

const TASKS_STORAGE_KEY = 'taskflowz.tasks';

// Compteur pour les IDs
let idCounter = 0;

// Fonction simple pour générer un ID unique
function generateId(): string {
    idCounter++;
    return `task_${idCounter}`;
}

export class TaskFlowsProvider implements vscode.TreeDataProvider<TaskTreeItem>, vscode.TreeDragAndDropController<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    readonly dropMimeTypes: string[] = ['application/vnd.code.tree.taskflows'];
    readonly dragMimeTypes: string[] = ['application/vnd.code.tree.taskflows'];

    private tasks: TaskData[] = [];
    private storage: vscode.Memento;
    private history: TaskData[][] = [];
    private currentHistoryIndex = -1;

    constructor(private context: vscode.ExtensionContext) {
        this.storage = context.globalState;
        this.loadTasks();
    }

    // Méthodes de TreeDataProvider
    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        const tasks = element ? element.data.children : this.tasks;
        if (!Array.isArray(tasks)) {
            return Promise.resolve([]);
        }
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
        this.saveToHistory();
        const newTask: TaskData = {
            id: generateId(),
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
        this.saveToHistory();
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
        this.saveToHistory();
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
        this.saveToHistory();
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
        console.log('TaskFlowz: Chargement des tâches...');
        try {
            const storedTasks = this.storage.get<TaskData[]>(TASKS_STORAGE_KEY);
            console.log('TaskFlowz: Tâches chargées:', storedTasks ? storedTasks.length : 0, 'tâches');
            this.tasks = Array.isArray(storedTasks) ? storedTasks : [];
            // Initialiser l'historique avec l'état initial
            this.history = [JSON.parse(JSON.stringify(this.tasks))];
            this.currentHistoryIndex = 0;
        } catch (error) {
            console.error('TaskFlowz: Erreur lors du chargement des tâches:', error);
            this.tasks = [];
            this.history = [[]];
            this.currentHistoryIndex = 0;
        }
    }

    private saveTasks() {
        console.log('TaskFlowz: Sauvegarde des tâches...');
        try {
            this.storage.update(TASKS_STORAGE_KEY, this.tasks);
            console.log('TaskFlowz: Tâches sauvegardées avec succès');
        } catch (error) {
            console.error('TaskFlowz: Erreur lors de la sauvegarde des tâches:', error);
        }
    }

    private refresh(): void {
        console.log('TaskFlowz: Rafraîchissement de la vue...');
        this._onDidChangeTreeData.fire();
    }

    // Méthode pour sauvegarder l'état actuel dans l'historique
    private saveToHistory() {
        // Supprimer les états après l'index actuel si on a fait un undo avant
        this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        // Ajouter l'état actuel
        this.history.push(JSON.parse(JSON.stringify(this.tasks)));
        this.currentHistoryIndex = this.history.length - 1;
    }

    // Méthode pour annuler la dernière action
    undo() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            this.tasks = JSON.parse(JSON.stringify(this.history[this.currentHistoryIndex]));
            this.saveTasks();
            this.refresh();
        }
    }

    // Méthode pour rétablir la dernière action annulée
    redo() {
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.currentHistoryIndex++;
            this.tasks = JSON.parse(JSON.stringify(this.history[this.currentHistoryIndex]));
            this.saveTasks();
            this.refresh();
        }
    }

    // Méthode pour vérifier si undo est disponible
    canUndo(): boolean {
        return this.currentHistoryIndex > 0;
    }

    // Méthode pour vérifier si redo est disponible
    canRedo(): boolean {
        return this.currentHistoryIndex < this.history.length - 1;
    }

    // Méthode pour trouver le chemin vers une tâche
    private findTaskPath(taskId: string, tasks: TaskData[] = this.tasks, path: TaskData[] = []): TaskData[] | null {
        for (const task of tasks) {
            if (task.id === taskId) {
                return [...path, task];
            }
            const childPath = this.findTaskPath(taskId, task.children, [...path, task]);
            if (childPath) {
                return childPath;
            }
        }
        return null;
    }

    // Méthode pour révéler une tâche dans la vue
    async revealTask(taskId: string, treeView: vscode.TreeView<TaskTreeItem>): Promise<void> {
        console.log('TaskFlowz: Tentative de révélation de la tâche:', taskId);
        
        // Attendre un court instant pour que l'arbre soit mis à jour
        await new Promise(resolve => setTimeout(resolve, 100));

        const path = this.findTaskPath(taskId);
        if (!path) {
            console.log('TaskFlowz: Chemin vers la tâche non trouvé');
            return;
        }

        try {
            console.log('TaskFlowz: Révélation du chemin de la tâche...');
            // Révéler chaque élément du chemin, du parent au fils
            for (const task of path) {
                const treeItem = new TaskTreeItem(task);
                await treeView.reveal(treeItem, { expand: true, select: false, focus: false });
            }

            // Sélectionner et donner le focus à la dernière tâche (celle qu'on cherche)
            console.log('TaskFlowz: Sélection et focus de la tâche cible');
            const finalTreeItem = new TaskTreeItem(path[path.length - 1]);
            await treeView.reveal(finalTreeItem, { expand: true, select: true, focus: true });
            console.log('TaskFlowz: Révélation de la tâche terminée avec succès');
        } catch (error) {
            console.log('TaskFlowz: Erreur ignorée lors de la révélation:', error);
        }
    }

    // Méthode pour obtenir la première tâche disponible
    getFirstTask(): TaskTreeItem | undefined {
        console.log('TaskFlowz: Recherche de la première tâche...');
        if (this.tasks.length > 0) {
            console.log('TaskFlowz: Première tâche trouvée:', this.tasks[0].label);
            return new TaskTreeItem(this.tasks[0]);
        }
        console.log('TaskFlowz: Aucune tâche trouvée');
        return undefined;
    }
} 