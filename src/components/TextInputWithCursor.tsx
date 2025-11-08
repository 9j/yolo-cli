/**
 * Enhanced TextInput with cursor control
 * Based on ink-text-input but with ability to force cursor to end
 */

import React, {useState, useEffect} from 'react';
import {Text, useInput} from 'ink';
import chalk from 'chalk';

export interface TextInputWithCursorProps {
	value: string;
	placeholder?: string;
	focus?: boolean;
	showCursor?: boolean;
	onChange?: (value: string) => void;
	onSubmit?: (value: string) => void;
	moveCursorToEnd?: boolean; // New prop!
}

export function TextInputWithCursor({
	value: originalValue = '',
	placeholder = '',
	focus = true,
	showCursor = true,
	onChange,
	onSubmit,
	moveCursorToEnd = false,
}: TextInputWithCursorProps) {
	const [state, setState] = useState({
		cursorOffset: originalValue.length,
		cursorWidth: 0,
	});

	const {cursorOffset, cursorWidth} = state;

	useEffect(() => {
		setState(previousState => {
			if (!focus || !showCursor) {
				return previousState;
			}

			const newValue = originalValue || '';

			// If moveCursorToEnd is true, always move cursor to end on value change
			if (moveCursorToEnd) {
				return {
					cursorOffset: newValue.length,
					cursorWidth: 0,
				};
			}

			// Otherwise, only move if cursor is out of bounds
			if (previousState.cursorOffset > newValue.length - 1) {
				return {
					cursorOffset: newValue.length,
					cursorWidth: 0,
				};
			}

			return previousState;
		});
	}, [originalValue, focus, showCursor, moveCursorToEnd]);

	const value = originalValue;
	let renderedValue = value;
	let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

	// Render cursor
	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0]!) + chalk.grey(placeholder.slice(1))
				: chalk.inverse(' ');

		renderedValue = value.length > 0 ? '' : chalk.inverse(' ');

		let i = 0;
		for (const char of value) {
			renderedValue +=
				i >= cursorOffset - cursorWidth && i <= cursorOffset
					? chalk.inverse(char)
					: char;
			i++;
		}

		if (value.length > 0 && cursorOffset === value.length) {
			renderedValue += chalk.inverse(' ');
		}
	}

	useInput(
		(input, key) => {
			if (
				key.upArrow ||
				key.downArrow ||
				(key.ctrl && input === 'c') ||
				key.tab ||
				(key.shift && key.tab)
			) {
				return;
			}

			// Shift+Enter - Insert newline
			if (key.return && key.shift) {
				const nextValue =
					originalValue.slice(0, cursorOffset) +
					'\n' +
					originalValue.slice(cursorOffset, originalValue.length);
				const nextCursorOffset = cursorOffset + 1;

				setState({
					cursorOffset: nextCursorOffset,
					cursorWidth: 0,
				});

				if (onChange) {
					onChange(nextValue);
				}

				return;
			}

			// Enter - Submit
			if (key.return) {
				if (onSubmit) {
					onSubmit(originalValue);
				}

				return;
			}

			let nextCursorOffset = cursorOffset;
			let nextValue = originalValue;
			let nextCursorWidth = 0;

			// Cmd/Ctrl+Left - Move to start of line or previous word
			if (key.leftArrow && (key.meta || key.ctrl)) {
				if (showCursor) {
					// Find start of current line
					const beforeCursor = originalValue.slice(0, cursorOffset);
					const lastNewline = beforeCursor.lastIndexOf('\n');
					nextCursorOffset = lastNewline + 1;
				}
			}
			// Cmd/Ctrl+Right - Move to end of line or next word
			else if (key.rightArrow && (key.meta || key.ctrl)) {
				if (showCursor) {
					// Find end of current line
					const afterCursor = originalValue.slice(cursorOffset);
					const nextNewline = afterCursor.indexOf('\n');
					if (nextNewline === -1) {
						nextCursorOffset = originalValue.length;
					} else {
						nextCursorOffset = cursorOffset + nextNewline;
					}
				}
			}
			// Ctrl+A - Move to start of line
			else if (key.ctrl && input === 'a') {
				if (showCursor) {
					const beforeCursor = originalValue.slice(0, cursorOffset);
					const lastNewline = beforeCursor.lastIndexOf('\n');
					nextCursorOffset = lastNewline + 1;
				}
			}
			// Ctrl+E - Move to end of line
			else if (key.ctrl && input === 'e') {
				if (showCursor) {
					const afterCursor = originalValue.slice(cursorOffset);
					const nextNewline = afterCursor.indexOf('\n');
					if (nextNewline === -1) {
						nextCursorOffset = originalValue.length;
					} else {
						nextCursorOffset = cursorOffset + nextNewline;
					}
				}
			}
			// Left arrow - Move cursor left
			else if (key.leftArrow) {
				if (showCursor) {
					nextCursorOffset--;
				}
			}
			// Right arrow - Move cursor right
			else if (key.rightArrow) {
				if (showCursor) {
					nextCursorOffset++;
				}
			}
			// Backspace/Delete - Delete character before cursor
			else if (key.backspace || key.delete) {
				if (cursorOffset > 0) {
					nextValue =
						originalValue.slice(0, cursorOffset - 1) +
						originalValue.slice(cursorOffset, originalValue.length);
					nextCursorOffset--;
				}
			}
			// Regular character input
			else {
				nextValue =
					originalValue.slice(0, cursorOffset) +
					input +
					originalValue.slice(cursorOffset, originalValue.length);
				nextCursorOffset += input.length;

				if (input.length > 1) {
					nextCursorWidth = input.length;
				}
			}

			if (nextCursorOffset < 0) {
				nextCursorOffset = 0;
			}

			if (nextCursorOffset > nextValue.length) {
				nextCursorOffset = nextValue.length;
			}

			setState({
				cursorOffset: nextCursorOffset,
				cursorWidth: nextCursorWidth,
			});

			if (onChange) {
				onChange(nextValue);
			}
		},
		{isActive: focus},
	);

	return <Text>{placeholder ? (value.length > 0 ? renderedValue : renderedPlaceholder) : renderedValue}</Text>;
}
