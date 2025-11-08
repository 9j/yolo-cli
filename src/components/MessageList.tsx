/**
 * Message list component - displays conversation history
 */

import React from 'react';
import {Box, Text} from 'ink';
import type {Message, ErrorInfo} from '../types/index.js';
import {formatTimestamp} from '../utils/formatting.js';

export interface MessageListProps {
	messages: Message[];
	streamingContent?: string;
	error?: ErrorInfo | null;
}

export function MessageList({messages, streamingContent, error}: MessageListProps) {
	return (
		<Box flexDirection="column" paddingX={1} paddingY={1}>
			{messages.map(message => {
				// Handle tool messages
				if (message.role === 'tool') {
					const toolName = message.metadata?.toolName ?? 'tool';
					return (
						<Box key={message.id} flexDirection="column" marginBottom={1}>
							<Box>
								<Text bold color="yellow">
									[{toolName}]
								</Text>
								<Text dimColor> executed</Text>
							</Box>
							<Text dimColor>{message.content.substring(0, 200)}</Text>
						</Box>
					);
				}

				// Handle regular user/assistant messages
				return (
					<Box key={message.id} flexDirection="column" marginBottom={1}>
						<Box>
							<Text bold color={message.role === 'user' ? 'cyan' : 'green'}>
								{message.role === 'user' ? 'You' : 'AI'}
							</Text>
							<Text dimColor> {formatTimestamp(message.timestamp)}</Text>
							{message.model && (
								<Text dimColor> ({message.model.split('/')[1]})</Text>
							)}
						</Box>
						<Text>{message.content}</Text>
						{message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								{message.metadata.toolCalls.map((tc, idx) => (
									<Text key={idx} dimColor>
										→ Calling {tc.function.name}
									</Text>
								))}
							</Box>
						)}
					</Box>
				);
			})}

			{streamingContent && (
				<Box flexDirection="column" marginBottom={1}>
					<Box>
						<Text bold color="green">
							AI
						</Text>
						<Text dimColor> streaming...</Text>
					</Box>
					<Text>{streamingContent}</Text>
				</Box>
			)}

			{error && (
				<Box flexDirection="column" marginTop={1}>
					<Text color="red" bold>
						Error: {error.message}
					</Text>
					{error.code && <Text color="red">Code: {error.code}</Text>}
				</Box>
			)}
		</Box>
	);
}
