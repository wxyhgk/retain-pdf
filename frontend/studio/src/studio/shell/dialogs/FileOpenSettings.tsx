import { useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { NativeSelect, NativeSelectOption } from '@studio/ui/native-select';
import { fileClickLabel, fileOpenWayLabel, fileOpenWays, setFileOpenWay, type FileClick, type FileOpenWay } from '../../files/file-open';
import { Field } from './AiSettings';

const CLICKS: FileClick[] = ['click', 'mod', 'alt'];
const WAYS: FileOpenWay[] = ['studio', 'app', 'folder'];

/** 设置 › 打开文件: for each way of clicking a link to a file of the article, how it opens; kept at once. */
export function FileOpenSettings() {
	const [ways, setWays] = useState(fileOpenWays);
	return (
		<div className="grid gap-4">
			{CLICKS.map((click) => (
				<Field key={click} label={fileClickLabel(click)}>
					<NativeSelect
						id={`file-open-${click}`}
						className="w-full"
						value={ways[click]}
						onChange={(event) => {
							setFileOpenWay(click, event.target.value as FileOpenWay);
							setWays(fileOpenWays());
						}}
					>
						{WAYS.map((way) => (
							<NativeSelectOption key={way} value={way}>
								{fileOpenWayLabel(way)}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			))}
			<p className="text-xs leading-normal text-muted-foreground">
				{t('「在 Studio 里打开」：脚本、数据这类文本在弹窗里看和改，PDF、图片、音视频、表格、Office 文件在弹窗里预览；压缩包这类 Studio 看不了的，用默认程序打开。⇧ 单击照旧是选中文字。')}
			</p>
		</div>
	);
}
