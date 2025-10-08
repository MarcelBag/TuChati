#backend/apps/accounts/serializers.py
# ===============================================================
# Custom JWT Serializer: login with username OR email
# ===============================================================
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepts either 'username' or 'email' in the payload, plus 'password'.
    We normalize to USERNAME_FIELD before calling the parent serializer.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Ensure BOTH possible inputs exist, and nothing is required up-front,
        # so DRF doesn't reject the request before validate() runs.
        self.fields.setdefault("username", serializers.CharField(required=False))
        self.fields.setdefault("email", serializers.EmailField(required=False))

        # Whatever the project's USERNAME_FIELD is (email in your case), make it not required here.
        username_field = get_user_model().USERNAME_FIELD
        if username_field in self.fields:
            self.fields[username_field].required = False

        # Password must still be required
        self.fields["password"].required = True

    def validate(self, attrs):
        User = get_user_model()
        username_field = User.USERNAME_FIELD  # likely "email" in your project

        login = attrs.get("username") or attrs.get("email")
        password = attrs.get("password")

        if not login or not password:
            raise serializers.ValidationError("Username/email and password are required.")

        # Normalize the provided login to whatever USERNAME_FIELD is
        lookup_value = login

        if username_field == "username" and "@" in login:
            # They typed an email, but we auth by username: map email -> username
            try:
                u = User.objects.get(email__iexact=login)
                lookup_value = u.username
            except User.DoesNotExist:
                pass

        if username_field == "email" and "@" not in login:
            # They typed a username, but we auth by email: map username -> email
            try:
                u = User.objects.get(username__iexact=login)
                lookup_value = u.email
            except User.DoesNotExist:
                pass

        # Tell the parent which field to use for authentication
        self.username_field = username_field

        parent_attrs = {username_field: lookup_value, "password": password}
        data = super().validate(parent_attrs)

        data["user"] = {
            "id": self.user.id,
            "username": getattr(self.user, "username", ""),
            "email": getattr(self.user, "email", ""),
        }
        return data
