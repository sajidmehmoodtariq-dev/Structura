export const outputExtractorMethods = {
  extractCoutOutput(node) {
    const text = node.text;

    let output = '';
    const coutParts = text.split('<<').slice(1); // Skip 'cout' part

    for (const part of coutParts) {
      const trimmed = part.trim().replace(/;$/, '').replace(/endl$/, '');

      // String literal
      const stringMatch = trimmed.match(/^"([^"]*)"/);
      if (stringMatch) {
        output += stringMatch[1];
        continue;
      }

      // Double pointer dereference: **handle
      const doubleDerefMatch = trimmed.match(/^\*\*(\w+)/);
      if (doubleDerefMatch) {
        output += `{**${doubleDerefMatch[1]}}`;
        continue;
      }

      // Single pointer dereference: *ptr
      const derefMatch = trimmed.match(/^\*(\w+)/);
      if (derefMatch) {
        output += `{*${derefMatch[1]}}`;
        continue;
      }

      // Struct field access: node->data
      const fieldAccessMatch = trimmed.match(/^(\w+)->(\w+)/);
      if (fieldAccessMatch) {
        output += `{${fieldAccessMatch[1]}->${fieldAccessMatch[2]}}`;
        continue;
      }

      // Array subscript: arr[2], pArr[2]
      const subscriptMatch = trimmed.match(/^(\w+)\[(\d+)\]/);
      if (subscriptMatch) {
        output += `{${subscriptMatch[1]}[${subscriptMatch[2]}]}`;
        continue;
      }

      // Variable reference
      const varMatch = trimmed.match(/^(\w+)/);
      if (varMatch) {
        output += `{${varMatch[1]}}`;
        continue;
      }
    }

    return output || 'Output';
  },
};
