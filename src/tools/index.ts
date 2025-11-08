/**
 * Tool registry - exports all available tools
 */

import {readFileTool} from './read-file.js';
import {writeFileTool} from './write-file.js';
import {bashTool} from './bash.js';
import {globTool} from './glob.js';
import {grepTool} from './grep.js';
import {strReplaceFileTool} from './str-replace-file.js';
import {thinkTool} from './think.js';
import {setTodoListTool} from './set-todo-list.js';
import type {Tool} from '../types/tools.js';

export const ALL_TOOLS: Tool[] = [
	readFileTool,
	writeFileTool,
	bashTool,
	globTool,
	grepTool,
	strReplaceFileTool,
	thinkTool,
	setTodoListTool,
];

export {
	readFileTool,
	writeFileTool,
	bashTool,
	globTool,
	grepTool,
	strReplaceFileTool,
	thinkTool,
	setTodoListTool,
};
