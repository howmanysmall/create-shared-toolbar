//!nocheck
//!nolint
//!optimize 2

// Got this from... Stravant? I think. If this is based on your code, please
// leave an issue or pull request about credit if you want it.

import { CoreGui } from "@rbxts/services";

/**
 * The settings for the shared toolbar.
 */
export interface SharedToolbarSettings {
	/**
	 * The button on the toolbar. You may need to do a non-null assertion for
	 * it to be defined.
	 */
	button?: PluginToolbarButton;

	/**
	 * The icon used for the button.
	 */
	readonly buttonIcon: string;

	/**
	 * The name of the button.
	 */
	readonly buttonName: string;

	/**
	 * The tooltip for the button.
	 */
	readonly buttonTooltip: string;

	/**
	 * The name of the combiner ObjectValue stored in CoreGui.
	 */
	readonly combinerName: string;

	/**
	 * Defines the behavior of the button when it is clicked.
	 * @returns
	 */
	readonly onClicked: () => void;

	/**
	 * The name of the toolbar.
	 */
	readonly toolbarName: string;
}

function getOrCreate<T extends keyof CreatableInstances>(
	parent: Instance,
	className: T,
	name: string,
): LuaTuple<[object: CreatableInstances[T], wasCreated: boolean]> {
	for (const child of parent.GetChildren())
		if (child.IsA(className) && child.Name === name) return $tuple(child, false);

	const object = new Instance(className);
	object.Name = name;
	object.Parent = parent;
	return $tuple(object, true);
}

/**
 * Creates a shared toolbar for a plugin.
 * @param plugin
 * @param sharedToolbarSettings
 */
export default function createSharedToolbar(plugin: Plugin, sharedToolbarSettings: SharedToolbarSettings) {
	const [combiner] = getOrCreate(CoreGui, "ObjectValue", sharedToolbarSettings.combinerName);
	const [owner] = getOrCreate(combiner, "ObjectValue", "Owner");

	let buttonConnection: RBXScriptConnection | undefined;

	function createButton(toolbar: PluginToolbar) {
		buttonConnection?.Disconnect();

		const [buttonReference, wasCreated] = getOrCreate(combiner, "ObjectValue", sharedToolbarSettings.buttonName);
		if (wasCreated) {
			buttonReference.Value = toolbar.CreateButton(
				sharedToolbarSettings.buttonName,
				sharedToolbarSettings.buttonTooltip,
				sharedToolbarSettings.buttonIcon,
			);
			buttonReference.Value.Name = `${plugin.Name}_${sharedToolbarSettings.buttonName}`;
		}

		const currentButton = buttonReference.Value;
		if (!currentButton?.IsA("PluginToolbarButton"))
			throw `Invalid button type ${currentButton?.ClassName ?? "nil"}`;

		buttonConnection = currentButton.Click.Connect(sharedToolbarSettings.onClicked);
		sharedToolbarSettings.button = currentButton;
	}

	{
		let toolbar = combiner.Value as PluginToolbar | undefined;
		if (!toolbar || !toolbar.IsA("PluginToolbar")) {
			toolbar = plugin.CreateToolbar(sharedToolbarSettings.toolbarName);
			combiner.Value = toolbar;
			owner.Value = plugin;
		}
		createButton(toolbar);
	}

	const onOwnerChanged = owner.Changed.Connect(() => {
		task.delay(0.5, () => {
			if (!owner.Value) {
				const toolbar = plugin.CreateToolbar(sharedToolbarSettings.toolbarName);
				toolbar.Name = `${plugin.Name}_Toolbar`;
				combiner.Value = toolbar;
				owner.Value = plugin;
			} else if (combiner.Value) createButton(combiner.Value as PluginToolbar);
		});
	});

	const onUnloading = plugin.Unloading.Once(() => {
		onUnloading.Disconnect();
		onOwnerChanged.Disconnect();
		buttonConnection?.Disconnect();

		if (owner.Value === plugin) {
			for (const child of combiner.GetChildren()) if (child !== owner) child.Destroy();
			combiner.Value = undefined;
			owner.Value = undefined;
		}
	});
}
