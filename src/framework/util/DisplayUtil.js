/**
 * DisplayUtil — 显示对象工具（收编工坊完整版：Text 独占纹理防泄漏）
 */

module.exports = {
  /** 移除并浅销毁全部子节点 */
  clearChildren: function (container) {
    while (container.children.length) {
      var c = container.children[container.children.length - 1];
      container.removeChild(c);
      if (c.destroy) { c.destroy({ children: true }); }
    }
  },

  /** 深度销毁：Text 的纹理为独占资源，需连纹理一起销毁 */
  deepDestroy: function (node) {
    if (!node) { return; }
    var isText = node.text !== undefined && node.style !== undefined;
    if (node.children) {
      while (node.children.length) {
        this.deepDestroy(node.children[node.children.length - 1]);
      }
    }
    if (node.parent) { node.parent.removeChild(node); }
    if (node.destroy) {
      node.destroy(isText ? { texture: true, baseTexture: true } : { children: true });
    }
  }
};
