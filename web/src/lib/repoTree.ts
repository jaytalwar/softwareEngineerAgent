import type { RepoNode } from "./types";

export const ACME_STORE_TREE: RepoNode = {
  type: "dir",
  name: "acme-store",
  path: "",
  children: [
    {
      type: "dir",
      path: "src",
      name: "src",
      children: [
        {
          type: "dir",
          path: "src/auth",
          name: "auth",
          children: [
            { type: "file", path: "src/auth/service.py", name: "service.py" },
            { type: "file", path: "src/auth/middleware.py", name: "middleware.py" },
          ],
        },
        {
          type: "dir",
          path: "src/payments",
          name: "payments",
          children: [{ type: "file", path: "src/payments/service.py", name: "service.py" }],
        },
        {
          type: "dir",
          path: "src/users",
          name: "users",
          children: [{ type: "file", path: "src/users/service.py", name: "service.py" }],
        },
      ],
    },
    {
      type: "dir",
      path: "tests",
      name: "tests",
      children: [
        { type: "file", path: "tests/test_auth.py", name: "test_auth.py" },
        { type: "file", path: "tests/test_payments.py", name: "test_payments.py" },
        { type: "file", path: "tests/test_users.py", name: "test_users.py" },
      ],
    },
    { type: "file", path: "README.md", name: "README.md" },
    { type: "file", path: "pyproject.toml", name: "pyproject.toml" },
  ],
};
