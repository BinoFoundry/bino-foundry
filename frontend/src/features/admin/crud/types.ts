/** Shared CRUD form callbacks for admin entity editors. */
export interface AdminEntityFormProps<T> {
  initial?: T;
  onSave: (entry: T) => void;
  onCancel: () => void;
}

export interface AdminCrudActions<T, TCreate = Omit<T, "id">> {
  create: (payload: TCreate) => void | Promise<void>;
  update: (entry: T) => void | Promise<void>;
  remove: (id: string) => void | Promise<void>;
}
