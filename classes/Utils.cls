public with sharing class Utils {
    @AuraEnabled
    public static String getUserSession() {
        return UserInfo.getSessionId();
    }
}