export function defineComponent({
  name,
  mount,
  update = null,
  unmount = null,
}: any = {}) {
  const componentName = `${name || ""}`.trim();
  if (!componentName) {
    throw new TypeError("Component requires a name.");
  }
  if (typeof mount !== "function") {
    throw new TypeError(`Component "${componentName}" requires a mount function.`);
  }
  return Object.freeze({
    name: componentName,
    mount,
    update,
    unmount,
  });
}

export function mountComponent(component, props = {}, context = {}) {
  if (!component || typeof component.mount !== "function") {
    throw new TypeError("mountComponent requires a component created by defineComponent.");
  }
  let mounted = true;
  const instance = component.mount(props, context) || {};

  return Object.freeze({
    name: component.name,
    update(nextProps = props) {
      if (!mounted) {
        return;
      }
      if (typeof instance.update === "function") {
        instance.update(nextProps, context);
        return;
      }
      if (typeof component.update === "function") {
        component.update(instance, nextProps, context);
      }
    },
    unmount() {
      if (!mounted) {
        return;
      }
      mounted = false;
      if (typeof instance.unmount === "function") {
        instance.unmount(context);
        return;
      }
      if (typeof component.unmount === "function") {
        component.unmount(instance, context);
      }
    },
  });
}
