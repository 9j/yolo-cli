/**
 * Autocomplete component for slash commands
 */

import React, {type FC} from 'react';
import {Box, Text} from 'ink';

export interface CommandSuggestion {
	command: string;
	aliases?: string[];
	description: string;
}

export interface CommandAutocompleteProps {
	suggestions: CommandSuggestion[];
	selectedIndex: number;
	inputText: string;
}

export const CommandAutocomplete: FC<CommandAutocompleteProps> = ({
	suggestions,
	selectedIndex,
	inputText,
}) => {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			marginTop={1}
		>
			<Text bold color="cyan">
				💡 Available commands:
			</Text>
			{suggestions.map((suggestion, index) => {
				const isSelected = index === selectedIndex;
				const commandText = `/${suggestion.command}`;
				const aliasText = suggestion.aliases?.length
					? ` (${suggestion.aliases.map(a => `/${a}`).join(', ')})`
					: '';

				return (
					<Box key={suggestion.command} flexDirection="row">
						<Text
							bold={isSelected}
							color={isSelected ? 'green' : 'white'}
							inverse={isSelected}
						>
							{isSelected ? '▶ ' : '  '}
							{commandText}
							{aliasText}
						</Text>
						<Text dimColor> - {suggestion.description}</Text>
					</Box>
				);
			})}
			<Box marginTop={1}>
				<Text dimColor>
					↑↓ Navigate • Tab Complete • Enter Execute • Esc Cancel
				</Text>
			</Box>
		</Box>
	);
};
