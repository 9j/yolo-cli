/**
 * Autocomplete component for @ file path mentions
 */

import React, {type FC} from 'react';
import {Box, Text} from 'ink';
import type {FilePathSuggestion} from '../utils/file-path-completer.js';

export interface FilePathAutocompleteProps {
	suggestions: FilePathSuggestion[];
	selectedIndex: number;
	fragment: string;
}

export const FilePathAutocomplete: FC<FilePathAutocompleteProps> = ({
	suggestions,
	selectedIndex,
	fragment,
}) => {
	if (suggestions.length === 0) {
		return null;
	}

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="magenta"
			paddingX={1}
			marginTop={1}
		>
			<Text bold color="magenta">
				📁 File paths matching &quot;@{fragment}&quot;:
			</Text>
			{suggestions.map((suggestion, index) => {
				const isSelected = index === selectedIndex;

				return (
					<Box key={suggestion.relativePath} flexDirection="row">
						<Text
							bold={isSelected}
							color={isSelected ? 'green' : 'white'}
							inverse={isSelected}
						>
							{isSelected ? '▶ ' : '  '}
							{suggestion.relativePath}
						</Text>
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
