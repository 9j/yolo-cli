/**
 * Input box component - handles user text input
 */

import React from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import {TextInputWithCursor} from './TextInputWithCursor.js';

export interface InputBoxProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void | Promise<void>;
	isLoading?: boolean;
	placeholder?: string;
	moveCursorToEnd?: boolean;
}

export function InputBox({
	value,
	onChange,
	onSubmit,
	isLoading = false,
	placeholder = 'Type your message...',
	moveCursorToEnd = false,
}: InputBoxProps) {
	if (isLoading) {
		return (
			<Box paddingX={1} paddingY={1} borderStyle="single" borderColor="gray">
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
				<Text dimColor> Loading...</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1} paddingY={1} borderStyle="single" borderColor="cyan">
			<Text color="cyan" bold>
				{'> '}
			</Text>
			<TextInputWithCursor
				value={value}
				onChange={onChange}
				onSubmit={onSubmit}
				placeholder={placeholder}
				moveCursorToEnd={moveCursorToEnd}
			/>
		</Box>
	);
}
