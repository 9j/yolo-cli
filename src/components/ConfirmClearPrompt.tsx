/**
 * Confirmation prompt for clearing conversation history
 * Feature: 004-slash-commands (User Story 1)
 */

import React, {type FC} from 'react';
import {Box, Text, useInput} from 'ink';

export interface ConfirmClearPromptProps {
	messageCount: number;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmClearPrompt: FC<ConfirmClearPromptProps> = ({
	messageCount,
	onConfirm,
	onCancel,
}) => {
	useInput((input, key) => {
		if (input.toLowerCase() === 'y') {
			onConfirm();
		} else if (input.toLowerCase() === 'n' || key.escape || key.return) {
			onCancel();
		}
	});

	return (
		<Box
			borderStyle="round"
			borderColor="yellow"
			flexDirection="column"
			paddingX={1}
		>
			<Text bold color="yellow">
				⚠️  Clear Conversation History
			</Text>
			<Text> </Text>
			<Text>
				This will permanently delete {messageCount} message
				{messageCount !== 1 ? 's' : ''} from this session.
			</Text>
			<Text> </Text>
			<Text dimColor>This action cannot be undone.</Text>
			<Text> </Text>
			<Text>
				Continue? (<Text color="green">y</Text>/
				<Text bold color="red">
					N
				</Text>
				)
			</Text>
		</Box>
	);
};
