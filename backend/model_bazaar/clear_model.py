from argparse import ArgumentParser

from DB import models
from DB.db import get_session
from storage import get_storage


def clear_model(saved_path):
    with get_session() as session:
        model: models.ModelZoo = (
            session.query(models.ModelZoo)
            .filter(models.ModelZoo.saved_path == saved_path)
            .first()
        )

        if not model:
            raise ValueError("No model exists with given name in the model zoo.")

        # So we also have to delete the uploaded model in our bucket.
        storage = get_storage()
        try:
            storage.delete(model.saved_path)
        except Exception as e:
            print(f"The following exception occurred while deleting the model, {e}")

        # Finally delete the object from the model zoo database.
        session.delete(model)
        print("The following row is deleted from database.")
        print(model.__repr__())
        session.commit()


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument(
        "--saved-path",
        type=str,
        required=True,
        help="Display name of the model you want to delete.",
    )
    args = parser.parse_args()

    clear_model(args.saved_path)
