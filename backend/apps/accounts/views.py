from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
import pyotp, qrcode, base64
from io import BytesIO
from .models import User
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer

def tokens(u):
    r=RefreshToken.for_user(u)
    return {'refresh':str(r),'access':str(r.access_token)}

class RegisterView(generics.CreateAPIView):
    serializer_class=RegisterSerializer
    permission_classes=[permissions.AllowAny]

class MeView(APIView):
    permission_classes=[permissions.IsAuthenticated]
    def get(self,req):
        return Response(UserSerializer(req.user).data)

class LoginView(generics.GenericAPIView):
    serializer_class=LoginSerializer
    permission_classes=[permissions.AllowAny]
    def post(self,req,*a,**kw):
        s=self.get_serializer(data=req.data); s.is_valid(raise_exception=True)
        u=s.validated_data['user']
        if u.is_2fa_enabled:
            t=AccessToken.for_user(u); t['two_factor']='pending'
            return Response({'detail':'2fa_required','temp_token':str(t)})
        return Response(tokens(u))

class TwoFASetupView(APIView):
    permission_classes=[permissions.IsAuthenticated]
    def post(self,req):
        u=req.user
        if u.is_2fa_enabled: return Response({'detail':'2FA already enabled'},status=400)
        secret=pyotp.random_base32(); u.totp_secret=secret; u.save(update_fields=['totp_secret'])
        uri=pyotp.TOTP(secret).provisioning_uri(name=u.username, issuer_name='TuChati')
        qr=qrcode.make(uri); buf=BytesIO(); qr.save(buf, format='PNG'); b64=base64.b64encode(buf.getvalue()).decode()
        return Response({'secret':secret,'otpauth_uri':uri,'qr_base64':b64})

class TwoFAEnableView(APIView):
    permission_classes=[permissions.IsAuthenticated]
    def post(self,req):
        u=req.user; otp=req.data.get('otp')
        if not u.totp_secret: return Response({'detail':'Call setup first'},status=400)
        if not otp or not pyotp.TOTP(u.totp_secret).verify(otp, valid_window=1):
            return Response({'detail':'Invalid OTP'},status=400)
        u.is_2fa_enabled=True; u.save(update_fields=['is_2fa_enabled'])
        return Response({'detail':'2FA enabled'})

class TwoFAVerifyView(APIView):
    permission_classes=[permissions.AllowAny]
    def post(self,req):
        temp=req.data.get('temp_token'); otp=req.data.get('otp')
        if not temp or not otp: return Response({'detail':'temp_token and otp required'},status=400)
        try:
            tok=AccessToken(temp)
        except Exception:
            return Response({'detail':'Invalid temp_token'},status=400)
        if tok.payload.get('two_factor')!='pending': return Response({'detail':'Not a 2FA pending token'},status=400)
        try:
            u=User.objects.get(id=tok.payload.get('user_id'))
        except User.DoesNotExist:
            return Response({'detail':'User not found'},status=404)
        if not u.is_2fa_enabled or not u.totp_secret: return Response({'detail':'2FA not enabled for user'},status=400)
        if not pyotp.TOTP(u.totp_secret).verify(otp, valid_window=1): return Response({'detail':'Invalid OTP'},status=400)
        return Response(tokens(u))
