from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_rename_accounts_em_email__2b246a_idx_accounts_em_email_b45245_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="share_timezone",
            field=models.BooleanField(default=True),
        ),
    ]
