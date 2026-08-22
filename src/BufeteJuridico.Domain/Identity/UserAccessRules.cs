namespace BufeteJuridico.Domain.Identity;

public static class UserAccessRules
{
    public static bool CanSignIn(UserAccount user, DateOnly today) =>
        user.IsActive &&
        !user.IsDeleted &&
        (user.ParticipationStartDate is null || user.ParticipationStartDate <= today) &&
        (user.ParticipationEndDate is null || user.ParticipationEndDate >= today);
}
