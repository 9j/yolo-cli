/**
 * ApprovalPrompt component - Request user approval for destructive operations
 */

import React from 'react';
import {Box, Text, useInput} from 'ink';

export interface ApprovalPromptProps {
	action: string; // e.g., "write_file", "bash"
	details: string; // e.g., "/path/to/file", "rm -rf /"
	onApprove: () => void;
	onReject: () => void;
}

export function ApprovalPrompt({
	action,
	details,
	onApprove,
	onReject,
}: ApprovalPromptProps) {
	useInput((input, key) => {
		if (key.return) {
			return; // Ignore Enter
		}

		const char = input.toLowerCase();
		if (char === 'y') {
			onApprove();
		} else if (char === 'n') {
			onReject();
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="yellow"
			padding={1}
			marginY={1}
		>
			<Box marginBottom={1}>
				<Text bold color="yellow">
					⚠️  Approval Required
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>
					Action: <Text bold>{action}</Text>
				</Text>
			</Box>

			<Box marginBottom={1}>
				<Text>Details: {details}</Text>
			</Box>

			<Box>
				<Text dimColor>Press </Text>
				<Text bold color="green">
					y
				</Text>
				<Text dimColor> to approve, </Text>
				<Text bold color="red">
					n
				</Text>
				<Text dimColor> to reject</Text>
			</Box>
		</Box>
	);
}
