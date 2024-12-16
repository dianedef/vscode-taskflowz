import * as vscode from 'vscode';
import { TaskData } from './types';

// Chargement du bundle de traduction
const messages = {
	en: require('../package.nls.json'),
	fr: require('../package.nls.fr.json')
};

// Fonction helper pour obtenir la traduction
function t(key: string): string {
	const language = vscode.env.language;
	const bundle = messages[language as keyof typeof messages] || messages.en;
	return bundle[key as keyof typeof messages.en] || messages.en[key as keyof typeof messages.en];
}

export class TaskTreeItem extends vscode.TreeItem {
    constructor(
        private readonly taskData: TaskData
    ) {
        super(
            taskData.label,
            taskData.children.length > 0 
                ? vscode.TreeItemCollapsibleState.Expanded 
                : vscode.TreeItemCollapsibleState.None
        );

        this.tooltip = taskData.label;
        this.contextValue = 'task';

        if (taskData.completed) {
            this.iconPath = new vscode.ThemeIcon('check');
            this.description = t('taskCompletedLabel');
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }

    get data(): TaskData {
        return this.taskData;
    }
} 